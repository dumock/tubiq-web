'use client';

import { useState } from 'react';
import Header from '@/src/components/Header';
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
    Clock
} from 'lucide-react';

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
    { id: 'n1', title: '정기 점검 안내', message: '내일 오전 2시부터 4시까지 서비스 점검이 있습니다.', type: 'Update', target: 'All', sentAt: '2025.12.20 14:30', status: 'Sent' },
    { id: 'n2', title: '신규 분석 엔진 업데이트', message: '더 정확한 데이터를 제공하는 엔진이 업데이트되었습니다.', type: 'Alert', target: 'All', sentAt: '2025.12.18 10:00', status: 'Sent' },
    { id: 'n3', title: '관리자 전용 기능 추가', message: '새로운 관리 도구가 대시보드에 추가되었습니다.', type: 'Promotion', target: 'Admins', sentAt: '2025.12.15 16:20', status: 'Sent' },
];

export default function AdminDashboardPage() {
    const [activeTab, setActiveTab] = useState<'members' | 'notifications'>('members');
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState<Member[]>(MOCK_MEMBERS);
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    // New Notification Form State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [notifType, setNotifType] = useState<Notification['type']>('Update');

    const filteredMembers = members.filter(m =>
        m.name.includes(searchTerm) || m.email.includes(searchTerm)
    );

    const handleSendNotification = (e: React.FormEvent) => {
        e.preventDefault();
        const newNotif: Notification = {
            id: `n${Date.now()}`,
            title: notifTitle,
            message: notifMessage,
            type: notifType,
            target: 'All',
            sentAt: new Date().toLocaleString('ko-KR', { hour12: false }).slice(0, 16),
            status: 'Sent'
        };
        setNotifications([newNotif, ...notifications]);
        setNotifTitle('');
        setNotifMessage('');
        alert('알림이 발송되었습니다.');
    };

    const handleDeleteNotification = (id: string) => {
        if (confirm('이 알림 기록을 삭제하시겠습니까?')) {
            setNotifications(notifications.filter(n => n.id !== id));
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
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">1,284명</p>
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
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">1,152명</p>
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
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">12명</p>
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
                                        {filteredMembers.map((member) => (
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
                        {/* New Notification Form */}
                        <div className="lg:col-span-1">
                            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">알림 발송</h2>
                                </div>

                                <form onSubmit={handleSendNotification} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">알림 제목</label>
                                        <input
                                            type="text"
                                            required
                                            value={notifTitle}
                                            onChange={(e) => setNotifTitle(e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                            placeholder="예: 서비스 점검 안내"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">알림 유형</label>
                                        <select
                                            value={notifType}
                                            onChange={(e) => setNotifType(e.target.value as Notification['type'])}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                        >
                                            <option value="Update">업데이트</option>
                                            <option value="Alert">긴급 공지</option>
                                            <option value="Promotion">이벤트 / 홍보</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">내용</label>
                                        <textarea
                                            required
                                            rows={5}
                                            value={notifMessage}
                                            onChange={(e) => setNotifMessage(e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all resize-none"
                                            placeholder="알림 내용을 입력하세요..."
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-sm"
                                    >
                                        <Send className="h-4 w-4" />
                                        알림 즉시 발송
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Recent Notifications Table */}
                        <div className="lg:col-span-2">
                            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden h-full">
                                <div className="p-6 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900 dark:text-white">최근 발송 내역</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">정상 발송 중</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/50 text-gray-500 dark:bg-zinc-800/50">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">알림 명</th>
                                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">유형</th>
                                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">대상</th>
                                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">발송 일시</th>
                                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {notifications.map((notif) => (
                                                <tr key={notif.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900 dark:text-white">{notif.title}</span>
                                                            <span className="text-xs text-gray-500 line-clamp-1">{notif.message}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-gray-700 dark:text-gray-300">
                                                            {notif.type === 'Update' ? '업데이트' : notif.type === 'Alert' ? '긴급' : '홍보'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                        {notif.target === 'All' ? '전체 회원' : '관리자 그룹'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                        {notif.sentAt}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteNotification(notif.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all dark:hover:bg-red-900/10"
                                                            title="기록 삭제"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
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
