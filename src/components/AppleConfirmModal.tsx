
import React from 'react';
import { createPortal } from 'react-dom';

interface AppleConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const AppleConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: AppleConfirmModalProps) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-white/85 dark:bg-zinc-800/85 backdrop-blur-xl rounded-[14px] w-[270px] overflow-hidden shadow-lg animate-in zoom-in-95 duration-200 scale-100">
                <div className="p-4 text-center space-y-1">
                    {title && (
                        <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                            {title}
                        </h3>
                    )}
                    <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-normal whitespace-pre-wrap">
                        {message}
                    </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 border-t border-gray-300/50 dark:border-zinc-700/50 divide-x divide-gray-300/50 dark:divide-zinc-700/50">
                    <button
                        onClick={onCancel}
                        className="h-[44px] text-[17px] text-blue-500 font-normal hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 active:bg-gray-300/50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={onConfirm}
                        className="h-[44px] text-[17px] text-blue-600 dark:text-blue-500 font-semibold hover:bg-gray-200/50 dark:hover:bg-zinc-700/50 active:bg-gray-300/50 transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AppleConfirmModal;
