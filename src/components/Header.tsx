'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, Menu, User, LayoutGrid, BarChart3, Folder, FileVideo, Database, Search as SearchIcon, X, TrendingUp } from 'lucide-react';
import LoginModal from './LoginModal';
import SignUpModal from './SignUpModal';
import ApiConfigModal from './ApiConfigModal';

const NAV_ITEMS = [
    { label: '대시보드', href: '/dashboard', icon: LayoutGrid },
    { label: '검색', href: '/search', icon: SearchIcon },
    { label: '채널분석', href: '/channel-analysis', icon: BarChart3 },
    { label: '채널에셋', href: '/channel-assets', icon: Folder },
    { label: '영상에셋', href: '/video-assets', icon: FileVideo },
    { label: '오늘급등', href: '/rising', icon: TrendingUp },
    { label: '채널수집', href: '/channel-collect', icon: Database },
];

const MOCK_NOTIFICATIONS = [
    { id: 'n1', title: '정기 점검 안내', message: '내일 오전 2시부터 4시까지 서비스 점검이 있습니다.', type: 'Update', time: '2시간 전', isRead: false },
    { id: 'n2', title: '신규 분석 엔진 업데이트', message: '더 정확한 데이터를 제공하는 엔진이 업데이트되었습니다.', type: 'Alert', time: '1일 전', isRead: true },
    { id: 'n3', title: '관리자 전용 기능 추가', message: '새로운 관리 도구가 대시보드에 추가되었습니다.', type: 'Promotion', time: '3일 전', isRead: true },
];

export default function Header() {
    const pathname = usePathname();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isSignUpOpen, setIsSignUpOpen] = useState(false);
    const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

    const hasUnread = notifications.some(n => !n.isRead);

    const handleMarkAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const handleLoginSuccess = () => {
        setIsLoginOpen(false);
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setIsMenuOpen(false);
    };

    return (
        <>
            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onLoginSuccess={handleLoginSuccess}
                onOpenSignUp={() => {
                    setIsLoginOpen(false);
                    setIsSignUpOpen(true);
                }}
            />
            <SignUpModal
                isOpen={isSignUpOpen}
                onClose={() => setIsSignUpOpen(false)}
                onOpenLogin={() => {
                    setIsSignUpOpen(false);
                    setIsLoginOpen(true);
                }}
            />
            <ApiConfigModal
                isOpen={isApiConfigOpen}
                onClose={() => setIsApiConfigOpen(false)}
            />
            <header className="sticky top-0 z-50 w-full border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Left Section: Logo & Mobile Menu */}
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg">
                            <Menu className="h-5 w-5" />
                        </button>

                        <Link href="/" className="flex items-center gap-2 mr-6">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-indigo-200">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="h-5 w-5"
                                >
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                                TubiQ
                            </span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex md:items-center md:gap-1">
                            {NAV_ITEMS.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
                                            }`}
                                    >
                                        <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-500'}`} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right Section: Search & Actions */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Search Bar */}
                        <div className="relative hidden sm:block">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="채널 검색..."
                                className="h-10 w-full min-w-[240px] appearance-none rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400 dark:focus:border-indigo-500 dark:focus:bg-zinc-950 dark:focus:ring-indigo-900/30"
                            />
                        </div>

                        <div className="flex items-center gap-2 border-l border-gray-200 pl-2 sm:pl-4 dark:border-zinc-800">
                            <div className="relative">
                                <button
                                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                    className="relative p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200 rounded-full transition-colors"
                                >
                                    <Bell className="h-5 w-5" />
                                    {hasUnread && (
                                        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950" />
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                {isNotificationsOpen && (
                                    <div className="absolute right-0 mt-3 w-[320px] sm:w-[380px] origin-top-right rounded-2xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-zinc-900 dark:ring-zinc-800 animate-in fade-in zoom-in duration-200 z-[60] overflow-hidden">
                                        <div className="px-4 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">알림</h3>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={handleMarkAllAsRead}
                                                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                                >
                                                    모두 읽음 처리
                                                </button>
                                                <button
                                                    onClick={() => setIsNotificationsOpen(false)}
                                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-gray-500 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800">
                                            {notifications.map((notif) => (
                                                <div
                                                    key={notif.id}
                                                    className={`p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}
                                                    onClick={() => {
                                                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                                                    }}
                                                >
                                                    <div className="flex gap-3">
                                                        {!notif.isRead && (
                                                            <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${notif.type === 'Alert' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                                                        )}
                                                        <div className={`flex flex-col gap-1 ${notif.isRead ? 'pl-5' : ''}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className={`text-sm font-bold line-clamp-1 ${notif.isRead ? 'text-gray-500 dark:text-gray-400 font-medium' : 'text-gray-900 dark:text-white'}`}>{notif.title}</span>
                                                                <span className="text-[10px] text-gray-400 whitespace-nowrap">{notif.time}</span>
                                                            </div>
                                                            <p className={`text-xs line-clamp-2 leading-relaxed ${notif.isRead ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                {notif.message}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="px-4 py-3 bg-gray-50/50 dark:bg-zinc-800/30 text-center border-t border-gray-50 dark:border-zinc-800">
                                            <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">전체 알림 보기</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div
                                className="relative"
                                onMouseEnter={() => isLoggedIn && setIsMenuOpen(true)}
                                onMouseLeave={() => setIsMenuOpen(false)}
                            >
                                <button
                                    onClick={() => !isLoggedIn && setIsLoginOpen(true)}
                                    className={`p-1 rounded-full border transition-all block ${isLoggedIn ? 'border-indigo-500/50 ring-2 ring-indigo-500/10' : 'border-gray-200 dark:border-zinc-800 hover:ring-2 hover:ring-gray-100'}`}
                                >
                                    <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                                        {isLoggedIn ? (
                                            <div className="h-full w-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                                AD
                                            </div>
                                        ) : (
                                            <User className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>
                                </button>

                                {/* User Menu Tooltip/Dropdown */}
                                {isLoggedIn && isMenuOpen && (
                                    <div className="absolute right-0 mt-3 w-56 origin-top-right divide-y divide-gray-100 rounded-2xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-zinc-900 dark:divide-zinc-800 dark:ring-zinc-800 animate-in fade-in zoom-in duration-200 z-[60] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']">
                                        <div className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold ring-2 ring-indigo-100 dark:ring-indigo-900/30">
                                                    AD
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Admin User</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">admin@tubiq.com</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="py-2">
                                            <button className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800 transition-colors">
                                                내 계정
                                            </button>
                                            <button className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800 transition-colors">
                                                설정
                                            </button>
                                            <button
                                                onClick={() => setIsApiConfigOpen(true)}
                                                className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800 transition-colors"
                                            >
                                                API / 연동
                                            </button>
                                            <Link
                                                href="/admin"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/10 transition-colors"
                                            >
                                                관리자 대시보드
                                            </Link>
                                        </div>
                                        <div className="py-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex w-full items-center px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10 transition-colors"
                                            >
                                                로그아웃
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}
