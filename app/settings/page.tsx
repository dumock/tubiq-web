'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import {
    Settings as SettingsIcon,
    Palette,
    Globe,
    Bell,
    Lock,
    Database,
    Download,
    Upload,
    Key,
    Moon,
    Sun,
    Monitor,
    Check,
    ChevronRight
} from 'lucide-react';

type TabType = 'appearance' | 'notifications' | 'privacy' | 'data';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('appearance');
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
    const [language, setLanguage] = useState('ko');
    const [compactView, setCompactView] = useState(false);

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [weeklyReport, setWeeklyReport] = useState(true);

    const tabs = [
        { id: 'appearance' as TabType, label: '외관', icon: Palette },
        { id: 'notifications' as TabType, label: '알림', icon: Bell },
        { id: 'privacy' as TabType, label: '개인정보', icon: Lock },
        { id: 'data' as TabType, label: '데이터', icon: Database },
    ];

    const handleExportData = () => {
        alert('데이터 내보내기 기능이 곧 제공됩니다.');
    };

    const handleImportData = () => {
        alert('데이터 가져오기 기능이 곧 제공됩니다.');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            <Header />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                        설정
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        애플리케이션 환경설정을 관리합니다.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-4">
                    {/* Sidebar Tabs */}
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
                            <nav className="space-y-1 p-2">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                                            {tab.label}
                                            <ChevronRight className={`ml-auto h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-3">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            {/* Appearance Tab */}
                            {activeTab === 'appearance' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">외관 설정</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            애플리케이션의 테마와 표시 방식을 변경합니다.
                                        </p>
                                    </div>

                                    {/* Theme Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            테마
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                onClick={() => setTheme('light')}
                                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${theme === 'light'
                                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                                        : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <Sun className={`h-6 w-6 ${theme === 'light' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium ${theme === 'light' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    라이트
                                                </span>
                                                {theme === 'light' && (
                                                    <Check className="h-4 w-4 text-indigo-600" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setTheme('dark')}
                                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${theme === 'dark'
                                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                                        : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <Moon className={`h-6 w-6 ${theme === 'dark' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    다크
                                                </span>
                                                {theme === 'dark' && (
                                                    <Check className="h-4 w-4 text-indigo-600" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setTheme('system')}
                                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${theme === 'system'
                                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                                        : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700'
                                                    }`}
                                            >
                                                <Monitor className={`h-6 w-6 ${theme === 'system' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium ${theme === 'system' ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    시스템
                                                </span>
                                                {theme === 'system' && (
                                                    <Check className="h-4 w-4 text-indigo-600" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Language Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            언어
                                        </label>
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition-all"
                                        >
                                            <option value="ko">한국어</option>
                                            <option value="en">English</option>
                                            <option value="ja">日本語</option>
                                        </select>
                                    </div>

                                    {/* Compact View Toggle */}
                                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">컴팩트 뷰</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">더 많은 정보를 한 화면에 표시합니다</p>
                                        </div>
                                        <button
                                            onClick={() => setCompactView(!compactView)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${compactView ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${compactView ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Notifications Tab */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">알림 설정</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            받고 싶은 알림을 선택하세요.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">이메일 알림</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">중요한 업데이트를 이메일로 받습니다</p>
                                            </div>
                                            <button
                                                onClick={() => setEmailNotifications(!emailNotifications)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotifications ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">푸시 알림</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">브라우저 푸시 알림을 받습니다</p>
                                            </div>
                                            <button
                                                onClick={() => setPushNotifications(!pushNotifications)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pushNotifications ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pushNotifications ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">주간 리포트</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">매주 활동 요약을 받습니다</p>
                                            </div>
                                            <button
                                                onClick={() => setWeeklyReport(!weeklyReport)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${weeklyReport ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${weeklyReport ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Privacy Tab */}
                            {activeTab === 'privacy' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">개인정보 설정</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            개인정보 보호 및 보안 설정을 관리합니다.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Key className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">API 키 관리</p>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                                YouTube API 키 및 기타 연동 설정을 관리합니다
                                            </p>
                                            <button className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                                API 설정 열기 →
                                            </button>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">데이터 암호화</p>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                모든 데이터는 전송 및 저장 시 암호화됩니다
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data Tab */}
                            {activeTab === 'data' && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">데이터 관리</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            데이터를 내보내거나 가져올 수 있습니다.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Download className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">데이터 내보내기</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        모든 채널, 영상, 폴더 데이터를 JSON 형식으로 다운로드합니다
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleExportData}
                                                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all"
                                            >
                                                <Download className="h-4 w-4" />
                                                내보내기
                                            </button>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
                                            <div className="flex items-center gap-3 mb-3">
                                                <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">데이터 가져오기</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        이전에 내보낸 데이터를 가져옵니다
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleImportData}
                                                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:bg-zinc-700 dark:border-zinc-600 dark:text-gray-300 transition-all"
                                            >
                                                <Upload className="h-4 w-4" />
                                                가져오기
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
