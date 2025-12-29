'use client';

import { useState, useEffect } from 'react';
import { Mail, Lock, ChevronRight, Github, Chrome, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess?: () => void;
    onOpenSignUp?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenSignUp }: LoginModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setError(null);
    }, [isOpen]);

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
        setIsLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes('Email not confirmed')) {
                    setError('인증되지 않은 이메일입니다. 메일함을 확인해주세요.');
                } else {
                    setError(authError.message);
                }
                return;
            }

            if (!data.session?.access_token) {
                setError('인증에 실패했습니다. 세션 정보를 가져올 수 없습니다.');
                return;
            }

            onLoginSuccess?.();
        } catch (err: any) {
            setError(err.message || '로그인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (!email) {
            setError('이메일을 입력해주세요.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: email,
            });
            if (resendError) {
                setError(resendError.message);
            } else {
                setError('인증 메일이 재발송되었습니다. 메일함을 확인해주세요.');
            }
        } catch (err: any) {
            setError(err.message || '재발송 중 오류가 발생했습니다.');
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
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className="h-7 w-7"
                            >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                TubiQ에 로그인
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                관리자 계정으로 서비스를 이용하세요
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/10 dark:text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <p className="font-medium flex-1">{error}</p>
                            </div>
                            {error.includes('인증되지 않은 이메일') && (
                                <button
                                    onClick={handleResendEmail}
                                    disabled={isLoading}
                                    className="mt-3 w-full text-xs font-bold text-red-700 underline hover:text-red-800 dark:text-red-300 flex items-center justify-center gap-1"
                                >
                                    인증 메일 다시 보내기
                                </button>
                            )}
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                이메일 주소
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    id="modal-email"
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
                            <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                비밀번호
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <input
                                    id="modal-password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 sm:text-sm transition-all dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-1">
                            <div className="flex items-center">
                                <input
                                    id="modal-remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:bg-zinc-800 dark:border-zinc-700"
                                />
                                <label htmlFor="modal-remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    로그인 유지
                                </label>
                            </div>
                            <button type="button" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                비밀번호 찾기
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98] mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    로그인 중...
                                </>
                            ) : (
                                <>
                                    로그인하기
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-100 dark:border-zinc-800" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-white text-gray-400 dark:bg-zinc-900">
                                    소셜 계정으로 로그인
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-700">
                                <Chrome className="h-5 w-5 text-red-500" />
                                Google
                            </button>
                            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-700">
                                <Github className="h-5 w-5" />
                                GitHub
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-xs text-gray-400">
                        아직 계정이 없으신가요?{' '}
                        <button
                            onClick={onOpenSignUp}
                            className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            회원가입
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
