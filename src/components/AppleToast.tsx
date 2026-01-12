import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface AppleToastProps {
    isOpen: boolean;
    message?: string;
    duration?: number;
    onClose: () => void;
}

const AppleToast = ({ isOpen, message = "저장되었습니다", duration = 1500, onClose }: AppleToastProps) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration, onClose]);

    if (!isOpen) return null;

    // Use portal to ensure it renders on top of everything
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none">
            {/* Toast Box */}
            <div className="flex flex-col items-center justify-center w-[160px] h-[160px] bg-gray-100/80 dark:bg-zinc-800/80 backdrop-blur-xl rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-200">
                <Check className="w-14 h-14 text-indigo-500 mb-4 stroke-[3]" />
                <p className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                    {message}
                </p>
            </div>
        </div>,
        document.body
    );
};

export default AppleToast;
