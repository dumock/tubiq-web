import { useState, useEffect } from 'react';
import { Calendar, Filter, PlaySquare } from 'lucide-react';
import { MOCK_VIDEOS as ALL_MOCK_VIDEOS } from '@/mock/videos';

interface VideoListTableProps {
    channelId: string;
    onVideoClick: (id: string) => void;
}

export default function VideoListTable({ channelId, onVideoClick }: VideoListTableProps) {
    const MAX_ROWS = 20;

    // Local state to track effective statuses (can be overridden by image load errors)
    const [videoStatuses, setVideoStatuses] = useState<Record<string, string>>({});

    const initialVideos = ALL_MOCK_VIDEOS
        .filter(v => v.channelId === channelId)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, MAX_ROWS);

    // Initialize statuses if not set
    useEffect(() => {
        const initialMap: Record<string, string> = {};
        initialVideos.forEach(v => {
            initialMap[v.id] = v.status;
        });
        setVideoStatuses(initialMap);
    }, [channelId]);

    const handleImageError = (videoId: string) => {
        setVideoStatuses(prev => ({
            ...prev,
            [videoId]: 'blocked_suspected'
        }));
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
            case 'private':
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
            case 'deleted':
                return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
            case 'blocked_suspected':
                return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return '정상';
            case 'private': return '비공개';
            case 'deleted': return '삭제됨';
            case 'blocked_suspected': return '저작권 의심';
            default: return status;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PlaySquare className="h-5 w-5 text-indigo-500" />
                        최근 업로드 영상
                    </h3>
                    <span className="text-xs text-gray-500">표시 개수: {initialVideos.length}</span>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <Filter className="h-4 w-4" />
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50/50 text-gray-500 dark:bg-zinc-800/50">
                        <tr>
                            <th className="px-6 py-4 font-semibold">썸네일</th>
                            <th className="px-6 py-4 font-semibold">영상 제목</th>
                            <th className="px-6 py-4 font-semibold">업로드일</th>
                            <th className="px-6 py-4 font-semibold text-right">오늘 조회수</th>
                            <th className="px-6 py-4 font-semibold text-right">누적 조회수</th>
                            <th className="px-6 py-4 font-semibold text-center">상태</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {initialVideos.map((video) => {
                            const effectiveStatus = videoStatuses[video.id] || video.status;
                            const isRestricted = effectiveStatus === 'deleted' || effectiveStatus === 'blocked_suspected';

                            return (
                                <tr
                                    key={video.id}
                                    onClick={() => onVideoClick(video.id)}
                                    className="hover:bg-gray-50/50 transition-colors dark:hover:bg-zinc-800/50 cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="h-16 w-28 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
                                            <img
                                                src={video.thumbnail}
                                                alt=""
                                                className={`h-full w-full object-cover transition-all duration-300 ${isRestricted ? 'grayscale opacity-60' : ''}`}
                                                onError={() => handleImageError(video.id)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <span className="font-bold text-gray-900 transition-colors text-left dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2">
                                            {video.title}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {video.uploadDate}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-indigo-600 font-bold dark:text-indigo-400">
                                        +{video.todayViews.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-900 dark:text-gray-200">
                                        {video.totalViews.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border-0 ${getStatusStyles(effectiveStatus)}`}>
                                            {getStatusLabel(effectiveStatus)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
