'use client';

import { useState, useEffect } from 'react';
import { Power, Activity, Loader2 } from 'lucide-react';

export default function GrokWorkerControl() {
    const [isRunning, setIsRunning] = useState(false);
    const [pid, setPid] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [pollCount, setPollCount] = useState(0);

    // Initial Status Check
    useEffect(() => {
        checkStatus();
        // Poll status every 10 seconds
        const interval = setInterval(() => {
            setPollCount(c => c + 1);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        checkStatus();
    }, [pollCount]);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/worker/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'status' })
            });
            const data = await res.json();
            setIsRunning(data.running);
            setPid(data.pid || null);
        } catch (e) {
            console.error('Failed to check worker status', e);
            setIsRunning(false);
        }
    };

    const toggleWorker = async () => {
        setIsLoading(true);
        const action = isRunning ? 'stop' : 'start';

        try {
            const res = await fetch('/api/worker/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();

            if (data.success) {
                setIsRunning(!isRunning);
                if (data.pid) setPid(data.pid);
                else if (action === 'stop') setPid(null);
            } else {
                alert('Worker Error: ' + data.message);
            }
        } catch (e) {
            alert('Failed to toggle worker');
        } finally {
            setIsLoading(false);
        }
    };

    const resetQueue = async () => {
        if (!confirm('정말 대기열을 초기화하시겠습니까? (로딩 중인 영상이 중단됩니다)')) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/worker/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('대기열이 초기화되었습니다.');
                // Trigger global status refresh if needed
                window.location.reload();
            }
        } catch (e) {
            alert('초기화 실패');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-3 bg-white rounded-xl p-2 pr-4 border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <div className={`p-2 rounded-lg transition-colors ${isRunning ? 'bg-green-100 text-green-600 shadow-inner' : 'bg-gray-100 text-gray-400'}`}>
                <Activity className={`h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />
            </div>

            <div className="flex flex-col min-w-[80px]">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Worker Daemon</span>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-black ${isRunning ? 'text-green-600' : 'text-gray-400'}`}>
                        {isRunning ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                    {pid && <span className="text-[8px] text-gray-300 font-mono bg-gray-50 px-1 rounded">ID:{pid}</span>}
                </div>
            </div>

            <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                <button
                    onClick={toggleWorker}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition-all ${isRunning
                        ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                        : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                        }`}
                    title={isRunning ? "서버 워커 정지" : "서버 워커 시작"}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                </button>

                {isRunning && (
                    <button
                        onClick={resetQueue}
                        disabled={isLoading}
                        className="p-2 rounded-lg bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                        title="대기열 초기화 (멈춤 해결)"
                    >
                        <Activity className="h-4 w-4 rotate-180" />
                    </button>
                )}
            </div>
        </div>
    );
}
