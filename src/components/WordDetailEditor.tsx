
import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { Play, Pause, X, RotateCcw } from 'lucide-react';

interface WordDetailEditorProps {
    word: string;
    startTime: number;
    endTime: number;
    audioUrl?: string; // Blob URL of the extracted audio
    onClose: () => void;
    onUpdate: (newStart: number, newEnd: number) => void;
}

const WordDetailEditor = ({
    word,
    startTime,
    endTime,
    audioUrl,
    onClose,
    onUpdate
}: WordDetailEditorProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [regionStart, setRegionStart] = useState(startTime);
    const [regionEnd, setRegionEnd] = useState(endTime);

    // Refs for event listeners to avoid stale closures
    const regionStartRef = useRef(startTime);
    const regionEndRef = useRef(endTime);

    // Update refs whenever state changes
    useEffect(() => {
        regionStartRef.current = regionStart;
        regionEndRef.current = regionEnd;
    }, [regionStart, regionEnd]);

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !audioUrl) return;

        // Create Regions Plugin instance
        const wsRegions = RegionsPlugin.create();
        regionsRef.current = wsRegions;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#d1d5db',
            progressColor: '#6366f1',
            height: 80,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            url: audioUrl,
            minPxPerSec: 100, // Zoom level
            plugins: [wsRegions],
        });

        // Add the word region
        ws.on('decode', () => {
            wsRegions.addRegion({
                id: 'word-region',
                start: startTime,
                end: endTime,
                color: 'rgba(99, 102, 241, 0.3)', // Indigo
                drag: true,
                resize: true,
            });
            // Zoom to the region with some padding
            const duration = endTime - startTime;
            const center = startTime + (duration / 2);
            ws.zoom(200); // 200px per second seems reasonable for word edit
            ws.setTime(startTime);
            const containerWidth = containerRef.current?.offsetWidth || 500;
        });

        wsRegions.on('region-updated', (region) => {
            setRegionStart(region.start);
            setRegionEnd(region.end);
            onUpdate(region.start, region.end);
        });

        wsRegions.on('region-clicked', (region, e) => {
            e.stopPropagation();
            ws.play(region.start, region.end);
        });

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => {
            setIsPlaying(false);
            // Snap to exact end if we paused near/past the end
            // use a small tolerance or just >= check
            const current = ws.getCurrentTime();
            const end = regionEndRef.current;
            if (current >= end - 0.05) { // 50ms tolerance
                ws.setTime(end);
            }
        });

        wavesurferRef.current = ws;

        return () => {
            ws.destroy();
        };
    }, [audioUrl]);

    // Update region and state when props change (e.g. switching words)
    useEffect(() => {
        if (regionsRef.current) {
            const region = regionsRef.current.getRegions().find(r => r.id === 'word-region');
            if (region) {
                region.setOptions({
                    start: startTime,
                    end: endTime
                });
                // Move playhead to start of new word
                if (wavesurferRef.current) {
                    wavesurferRef.current.setTime(startTime);
                }
            }
        }
        setRegionStart(startTime);
        setRegionEnd(endTime);
    }, [startTime, endTime]);

    // toggle play
    const handlePlayPause = () => {
        if (wavesurferRef.current) {
            if (isPlaying) {
                wavesurferRef.current.pause();
            } else {
                // Explicitly play the range tracked by state
                wavesurferRef.current.play(regionStart, regionEnd);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 rounded-lg p-3 mt-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        상세 편집: <span className="text-indigo-600">{word}</span>
                    </span>
                    <span className="text-xs bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-gray-500">
                        {(regionEnd - regionStart).toFixed(2)}s
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePlayPause} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
                        {isPlaying ? <Pause className="h-4 w-4 text-indigo-500" /> : <Play className="h-4 w-4 text-gray-500" />}
                    </button>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Waveform Container */}
            <div ref={containerRef} className="w-full relative" />

            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                <span>Start: {regionStart.toFixed(2)}s</span>
                <span>End: {regionEnd.toFixed(2)}s</span>
            </div>

            <p className="text-center text-[10px] text-gray-400 mt-2">
                파형 위의 구간(보라색)을 드래그하여 싱크를 조절하세요.
            </p>
        </div>
    );
};

export default React.memo(WordDetailEditor);
