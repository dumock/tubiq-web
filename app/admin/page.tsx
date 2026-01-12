'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
    Users,
    UserCheck,
    UserMinus,
    Search,
    Filter,
    MoreHorizontal,
    Shield,
    Mail,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Trash2,
    Ban,
    Bell,
    Send,
    AlertCircle,
    CheckCircle2,
    Clock,
    Save,
    X,
    Eye,
    EyeOff
} from 'lucide-react';
import AppleDatePicker from '@/components/AppleDatePicker';
import AppleRangeDatePicker from '@/components/AppleRangeDatePicker';

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Suspended' | 'Pending';
    joinedAt: string;
    lastLoginActual: string;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'Update' | 'Alert' | 'Promotion';
    target: 'All' | 'Admins' | 'Specific';
    sentAt: string;
    status: 'Sent' | 'Scheduled';
    isVisible: boolean;
    displayFrom?: string;
    displayUntil?: string;
}

const MOCK_MEMBERS: Member[] = [
    { id: '1', name: '김재우', email: 'admin@tubiq.com', role: 'Admin', status: 'Active', joinedAt: '2023.10.15', lastLoginActual: '방금 전' },
    { id: '2', name: '이민수', email: 'mslee@gmail.com', role: 'Editor', status: 'Active', joinedAt: '2023.11.02', lastLoginActual: '2시간 전' },
    { id: '3', name: '박지성', email: 'jisung@naver.com', role: 'Viewer', status: 'Pending', joinedAt: '2024.01.20', lastLoginActual: '-' },
    { id: '4', name: '최유진', email: 'yujin_c@daum.net', role: 'Editor', status: 'Active', joinedAt: '2023.12.05', lastLoginActual: '1일 전' },
    { id: '5', name: '정호석', email: 'hobi@gmail.com', role: 'Viewer', status: 'Suspended', joinedAt: '2023.09.12', lastLoginActual: '1주일 전' },
    { id: '6', name: '강하늘', email: 'sky_kang@tubiq.com', role: 'Viewer', status: 'Active', joinedAt: '2024.02.01', lastLoginActual: '3시간 전' },
    { id: '7', name: '한소희', email: 'sohee@naver.com', role: 'Editor', status: 'Active', joinedAt: '2023.10.28', lastLoginActual: '5분 전' },
    { id: '8', name: '윤아름', email: 'arumy@gmail.com', role: 'Viewer', status: 'Active', joinedAt: '2024.03.10', lastLoginActual: '12시간 전' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
    { id: 'n1', title: '정기 점검 안내', message: '내일 오전 2시부터 4시까지 서비스 점검이 있습니다.', type: 'Update', target: 'All', sentAt: '2025.12.20 14:30', status: 'Sent', isVisible: true },
    { id: 'n2', title: '신규 분석 엔진 업데이트', message: '더 정확한 데이터를 제공하는 엔진이 업데이트되었습니다.', type: 'Alert', target: 'All', sentAt: '2025.12.18 10:00', status: 'Sent', isVisible: true },
    { id: 'n3', title: '관리자 전용 기능 추가', message: '새로운 관리 도구가 대시보드에 추가되었습니다.', type: 'Promotion', target: 'Admins', sentAt: '2025.12.15 16:20', status: 'Sent', isVisible: true },
];

export default function AdminDashboardPage() {
    const [activeTab, setActiveTab] = useState<'members' | 'notifications'>('members');
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
    const [isLoading, setIsLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [activeUsers, setActiveUsers] = useState(0);
    const [pendingUsers, setPendingUsers] = useState(0);

    // Fetch real users from Supabase
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/admin/users');
                const result = await response.json();

                if (result.ok && result.data) {
                    // Transform API data to Member interface
                    const transformedMembers: Member[] = result.data.map((user: any) => {
                        const createdDate = new Date(user.created_at);
                        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
                        const isEmailConfirmed = !!user.email_confirmed_at;

                        // Calculate time since last login
                        let lastLoginText = '-';
                        if (lastSignIn) {
                            const now = new Date();
                            const diffMs = now.getTime() - lastSignIn.getTime();
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMs / 3600000);
                            const diffDays = Math.floor(diffMs / 86400000);

                            if (diffMins < 5) lastLoginText = '방금 전';
                            else if (diffMins < 60) lastLoginText = `${diffMins}분 전`;
                            else if (diffHours < 24) lastLoginText = `${diffHours}시간 전`;
                            else lastLoginText = `${diffDays}일 전`;
                        }

                        return {
                            id: user.id,
                            name: user.email?.split('@')[0] || 'Unknown',
                            email: user.email || '',
                            role: 'Viewer' as const, // Default role
                            status: isEmailConfirmed ? 'Active' : 'Pending',
                            joinedAt: createdDate.toLocaleDateString('ko-KR').replace(/\. /g, '.').slice(0, -1),
                            lastLoginActual: lastLoginText
                        };
                    });

                    setMembers(transformedMembers);
                    setTotalUsers(transformedMembers.length);
                    setActiveUsers(transformedMembers.filter(m => m.status === 'Active').length);
                    setPendingUsers(transformedMembers.filter(m => m.status === 'Pending').length);
                } else {
                    console.error('Failed to fetch users:', result.message);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // New Notification Form State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [notifType, setNotifType] = useState<Notification['type']>('Update');
    const [notifDisplayFrom, setNotifDisplayFrom] = useState('');
    const [notifDisplayUntil, setNotifDisplayUntil] = useState('');
    const [editingNotifId, setEditingNotifId] = useState<string | null>(null);
    const [editNotifTitle, setEditNotifTitle] = useState('');
    const [editNotifMessage, setEditNotifMessage] = useState('');

    const filteredMembers = members.filter(m =>
        m.name.includes(searchTerm) || m.email.includes(searchTerm)
    );

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: notifTitle,
                    message: notifMessage,
                    type: notifType,
                    target: 'All',
                    displayFrom: notifDisplayFrom || undefined,
                    displayUntil: notifDisplayUntil || undefined
                })
            });

            const result = await response.json();

            if (result.ok) {
                // Add to local state for immediate UI update
                const newNotif: Notification = {
                    id: result.data.id,
                    title: notifTitle,
                    message: notifMessage,
                    type: notifType,
                    target: 'All',
                    sentAt: result.data.sentAt,
                    status: 'Sent',
                    isVisible: true,
                    displayFrom: notifDisplayFrom || undefined,
                    displayUntil: notifDisplayUntil || undefined
                };
                setNotifications([newNotif, ...notifications]);
                setNotifTitle('');
                setNotifMessage('');
                setNotifDisplayFrom('');
                setNotifDisplayUntil('');
                alert('알림이 발송되었습니다. 설정된 기간 동안 사용자에게 표시됩니다.');
            } else {
                alert(`알림 발송 실패: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to send notification:', error);
            alert('알림 발송 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteNotification = async (id: string) => {
        if (confirm('이 알림 기록을 삭제하시겠습니까?')) {
            try {
                const response = await fetch(`/api/notifications?id=${id}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (result.ok) {
                    setNotifications(notifications.filter(n => n.id !== id));
                    alert('알림이 삭제되었습니다.');
                } else {
                    alert(`삭제 실패: ${result.message}`);
                }
            } catch (error) {
                console.error('Failed to delete notification:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const handleEditNotification = (notif: Notification) => {
        setEditingNotifId(notif.id);
        setEditNotifTitle(notif.title);
        setEditNotifMessage(notif.message);
    };

    const handleSaveEdit = async (id: string) => {
        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id,
                    title: editNotifTitle,
                    message: editNotifMessage
                })
            });

            const result = await response.json();

            if (result.ok) {
                setNotifications(notifications.map(n =>
                    n.id === id
                        ? { ...n, title: editNotifTitle, message: editNotifMessage }
                        : n
                ));
                setEditingNotifId(null);
                setEditNotifTitle('');
                setEditNotifMessage('');
                alert('알림이 수정되었습니다.');
            } else {
                alert(`수정 실패: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to update notification:', error);
            alert('수정 중 오류가 발생했습니다.');
        }
    };

    const handleCancelEdit = () => {
        setEditingNotifId(null);
        setEditNotifTitle('');
        setEditNotifMessage('');
    };

    const handleToggleVisibility = async (id: string, currentVisibility: boolean) => {
        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id,
                    isVisible: !currentVisibility
                })
            });

            const result = await response.json();

            if (result.ok) {
                setNotifications(notifications.map(n =>
                    n.id === id ? { ...n, isVisible: !currentVisibility } : n
                ));
            } else {
                alert(`표시 여부 변경 실패: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to toggle visibility:', error);
            alert('표시 여부 변경 중 오류가 발생했습니다.');
        }
    };

    const handleUpdateDateRange = async (id: string, displayFrom?: string, displayUntil?: string) => {
        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id,
                    displayFrom,
                    displayUntil
                })
            });

            const result = await response.json();

            if (result.ok) {
                setNotifications(notifications.map(n =>
                    n.id === id ? { ...n, displayFrom, displayUntil } : n
                ));
            } else {
                alert(`날짜 범위 변경 실패: ${result.message}`);
            }
        } catch (error) {
            console.error('Failed to update date range:', error);
            alert('날짜 범위 변경 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">관리자 대시보드</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {activeTab === 'members' ? '서비스 이용 회원 목록과 권한을 관리합니다.' : '사용자들에게 중요한 알림 및 공지사항을 발송합니다.'}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-8 flex border-b border-gray-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'members' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        회원 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'notifications' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        알림 관리
                    </button>
                </div>

                {activeTab === 'members' ? (
                    <>
                        {/* Member Stats Grid */}
                        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">전체 회원</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}명</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-xl bg-green-50 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                        <UserCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">활성 회원</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeUsers}명</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <div className="rounded-xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                        <Mail className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">대기 중</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingUsers}명</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Member Table Section */}
                        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
                            {/* Table Filters */}
                            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-gray-50 dark:border-zinc-800">
                                <div className="relative w-full max-w-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="회원 이름 또는 이메일 검색..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:focus:ring-indigo-900/20 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors">
                                        <Filter className="h-4 w-4" />
                                        필터
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50/50 text-gray-500 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">회원 정보</th>
                                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">권한</th>
                                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">상태</th>
                                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">최근 접속</th>
                                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">사용자 정보를 불러오는 중...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredMembers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {searchTerm ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMembers.map((member) => (
                                                <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold dark:bg-indigo-900/20 dark:text-indigo-400">
                                                                {member.name.slice(0, 1)}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-gray-900 dark:text-white">{member.name}</span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">{member.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-1.5">
                                                            <Shield className={`h-4 w-4 ${member.role === 'Admin' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                {member.role === 'Admin' ? '관리자' : member.role === 'Editor' ? '편집자' : '일반 회원'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${member.status === 'Active'
                                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900'
                                                            : member.status === 'Suspended'
                                                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'
                                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900'
                                                            }`}>
                                                            {member.status === 'Active' ? '활성' : member.status === 'Suspended' ? '정지됨' : '승인 대기'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-gray-600 dark:text-gray-400">
                                                        {member.lastLoginActual}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2 text-gray-400">
                                                            <button className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all dark:hover:bg-indigo-900/20">
                                                                <Edit3 className="h-4 w-4" />
                                                            </button>
                                                            <button className="p-1.5 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all dark:hover:bg-amber-900/20">
                                                                <Ban className="h-4 w-4" />
                                                            </button>
                                                            <button className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all dark:hover:bg-red-900/20">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
                        {/* New Notification Form - Top Section */}
                        <div className="relative group">
                            {/* Glassmorphism Background Layer */}
                            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-rose-500/20 blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>

                            <div className="relative rounded-3xl border border-white/40 bg-white/60 p-8 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/60 dark:border-zinc-800/40">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
                                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl"></div>

                                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                                            <Bell className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">알림 발송</h2>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">사용자들에게 우측 상단 종 아이콘을 통해 공지사항을 실시간으로 전달합니다.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">System Ready</span>
                                    </div>
                                </div>

                                <form onSubmit={handleSendNotification} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="lg:col-span-2">
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">알림 제목</label>
                                        <input
                                            type="text"
                                            required
                                            value={notifTitle}
                                            onChange={(e) => setNotifTitle(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-3.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white transition-all duration-300"
                                            placeholder="예: 서비스 점검 안내"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">알림 유형</label>
                                        <select
                                            value={notifType}
                                            onChange={(e) => setNotifType(e.target.value as Notification['type'])}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-3.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white transition-all duration-300 appearance-none"
                                        >
                                            <option value="Update">업데이트</option>
                                            <option value="Alert">긴급 공지</option>
                                            <option value="Promotion">이벤트 / 홍보</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-1 lg:col-span-1">
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">표시 기간 (선택)</label>
                                        <AppleRangeDatePicker
                                            startDate={notifDisplayFrom}
                                            endDate={notifDisplayUntil}
                                            onRangeChange={(start, end) => {
                                                setNotifDisplayFrom(start);
                                                setNotifDisplayUntil(end);
                                            }}
                                            placeholder="노출 기간 선택"
                                            position="bottom"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">발송 내용</label>
                                        <textarea
                                            required
                                            rows={1}
                                            value={notifMessage}
                                            onChange={(e) => setNotifMessage(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-5 py-3.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-white transition-all duration-300 resize-none min-h-[54px]"
                                            placeholder="알림 내용을 자세히 입력하세요..."
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-1 flex items-end">
                                        <button
                                            type="submit"
                                            className="w-full h-[54px] flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                                        >
                                            <Send className="h-4 w-4" />
                                            알림 발송하기
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Recent Notifications Table - Bottom Section */}
                        <div className="relative group">
                            <div className="absolute -inset-1 rounded-[2.5rem] bg-white/20 blur-xl opacity-30 dark:bg-black/20"></div>

                            <div className="relative rounded-3xl border border-white/40 bg-white/70 shadow-2xl backdrop-blur-2xl dark:bg-zinc-900/70 dark:border-zinc-800/40">
                                <div className="p-8 border-b border-gray-100/50 dark:border-zinc-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                                            <MoreHorizontal className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">최근 발송 내역</h3>
                                    </div>
                                    <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-800/50 px-4 py-2 rounded-2xl border border-white/50 dark:border-zinc-700/50">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Monitoring Status</span>
                                        </div>
                                        <div className="h-4 w-[1px] bg-gray-200 dark:bg-zinc-700" />
                                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">LIVE</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                                        <thead className="bg-gray-100/30 dark:bg-zinc-800/50 backdrop-blur-md sticky top-0 z-20">
                                            <tr>
                                                <th className="px-8 py-5 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px] whitespace-nowrap">알림 정보</th>
                                                <th className="px-8 py-5 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px] whitespace-nowrap text-center">유형</th>
                                                <th className="px-8 py-5 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px] whitespace-nowrap text-center">대상</th>
                                                <th className="px-8 py-5 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px] whitespace-nowrap text-center">표시 상태</th>
                                                <th className="px-8 py-5 font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px] whitespace-nowrap text-center">표시 일정</th>
                                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs whitespace-nowrap">발송 일시</th>
                                                <th className="px-6 py-4 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs whitespace-nowrap text-right">기능</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {notifications.map((notif) => (
                                                <tr key={notif.id} className="group hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-all duration-300">
                                                    <td className="px-6 py-5 min-w-[280px]">
                                                        {editingNotifId === notif.id ? (
                                                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                                                                <input
                                                                    type="text"
                                                                    value={editNotifTitle}
                                                                    onChange={(e) => setEditNotifTitle(e.target.value)}
                                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all shadow-sm"
                                                                    placeholder="알림 제목"
                                                                />
                                                                <textarea
                                                                    value={editNotifMessage}
                                                                    onChange={(e) => setEditNotifMessage(e.target.value)}
                                                                    rows={2}
                                                                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 resize-none transition-all shadow-sm"
                                                                    placeholder="알림 상세 내용"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{notif.title}</span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">{notif.message}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex justify-center">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight whitespace-nowrap ${notif.type === 'Update'
                                                                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-blue-900/20 dark:text-blue-400'
                                                                : notif.type === 'Alert'
                                                                    ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-900/20 dark:text-amber-400'
                                                                    : 'bg-purple-50 text-purple-600 ring-1 ring-purple-500/20 dark:bg-purple-900/20 dark:text-purple-400'
                                                                }`}>
                                                                {notif.type === 'Update' ? '업데이트' : notif.type === 'Alert' ? '긴급 공지' : '이벤트'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                                                            {notif.target === 'All' ? '전체 회원' : '관리자'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <button
                                                            onClick={() => handleToggleVisibility(notif.id, notif.isVisible)}
                                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 ${notif.isVisible
                                                                ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                                                                : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:ring-zinc-700'
                                                                }`}
                                                        >
                                                            <div className={`h-1.5 w-1.5 rounded-full ${notif.isVisible ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
                                                            {notif.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                                            <span className="whitespace-nowrap">{notif.isVisible ? '표시 중' : '비표시'}</span>
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-5 min-w-[240px]">
                                                        <AppleRangeDatePicker
                                                            startDate={notif.displayFrom || ''}
                                                            endDate={notif.displayUntil || ''}
                                                            onRangeChange={(start, end) => handleUpdateDateRange(notif.id, start, end)}
                                                            placeholder="기간 설정"
                                                            position="top" // History table rows need it to open UP
                                                        />
                                                    </td>
                                                    <td className="px-6 py-5 whitespace-nowrap">
                                                        <div className="flex flex-col text-[10px] text-gray-500 dark:text-gray-400">
                                                            <span className="font-bold text-gray-700 dark:text-gray-300">{notif.sentAt.split(' ')[0]}</span>
                                                            <span className="opacity-70">{notif.sentAt.split(' ')[1]}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right whitespace-nowrap">
                                                        {editingNotifId === notif.id ? (
                                                            <div className="flex items-center justify-end gap-2 animate-in zoom-in-95 duration-200">
                                                                <button
                                                                    onClick={() => handleSaveEdit(notif.id)}
                                                                    className="p-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                                                                    title="저장"
                                                                >
                                                                    <Save className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={handleCancelEdit}
                                                                    className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all dark:hover:bg-zinc-800"
                                                                    title="취소"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                                                <button
                                                                    onClick={() => handleEditNotification(notif)}
                                                                    className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all dark:hover:bg-indigo-900/20"
                                                                    title="수정"
                                                                >
                                                                    <Edit3 className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteNotification(notif.id)}
                                                                    className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all dark:hover:bg-rose-900/20"
                                                                    title="삭제"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
