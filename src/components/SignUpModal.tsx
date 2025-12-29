'use client';

import { useState, useEffect } from 'react';
import { Mail, Lock, ChevronRight, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SignUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenLogin: () => void;
}

export default function SignUpModal({ isOpen, onClose, onOpenLogin }: SignUpModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) {
                setError(authError.message);
                return;
            }

            setIsSuccess(true);
            // Longer timeout to allow reading instructions
            setTimeout(() => {
                // Only redirect if still in success state
                setIsSuccess(current => {
                    if (current) onOpenLogin();
                    return false;
                });
            }, 10000);
        } catch (err: any) {
            setError(err.message || '회원가입 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md scale-100 transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-8 sm:p-10">
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                            <PlusIcon className="h-7 w-7" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                서비스 가입하기
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                새로운 계정을 생성하고 TubiQ를 시작하세요
                            </p>
                        </div>
                    </div>

                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in duration-300">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">가입 완료! 이메일을 확인하세요</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                                <strong>{email}</strong> 주소로 인증 메일을 보냈습니다.<br />
                                이메일 안의 링크를 클릭해야 로그인이 가능합니다.
                            </p>
                            <button
                                onClick={onOpenLogin}
                                className="w-full flex justify-center items-center py-3 px-4 border border-indigo-600 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all active:scale-[0.98]"
                            >
                                로그인 화면으로 이동
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/10 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div>
                                    <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        이메일 주소
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="signup-email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 sm:text-sm transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                            placeholder="example@tubiq.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        비밀번호
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="signup-password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 sm:text-sm transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        비밀번호 확인
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            id="signup-confirm"
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 sm:text-sm transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            처리 중...
                                        </>
                                    ) : (
                                        <>
                                            가입하기
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="mt-8 text-center text-xs text-gray-400">
                                이미 계정이 있으신가요?{' '}
                                <button
                                    onClick={onOpenLogin}
                                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    로그인
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={className}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    );
}
