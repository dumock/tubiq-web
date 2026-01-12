import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoClip {
    id: string;
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    src?: string; // Optional: support multiple sources later
    // ... other props
}

interface UseTimelineEngineProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    videoClips: VideoClip[];
    onTimeUpdate: (time: number) => void;
    duration: number;
}

export function useTimelineEngine({ videoRef, videoClips, onTimeUpdate, duration }: UseTimelineEngineProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const requestRef = useRef<number | undefined>(undefined);
    const previousTimeRef = useRef<number | undefined>(undefined);
    const lastVideoTimeCheck = useRef<number>(0);

    // Master Clock Loop
    const animate = useCallback((time: number) => {
        if (previousTimeRef.current !== undefined) {
            const deltaTime = (time - previousTimeRef.current) / 1000;

            // Advance Master Time
            setCurrentTime(prevTime => {
                let newTime = prevTime + deltaTime;
                if (newTime >= duration) {
                    setIsPlaying(false);
                    return duration; // or 0 to loop
                }

                // --- SEQUENCING LOGIC ---
                const video = videoRef.current;
                if (video) {
                    // 1. Find which clip we are in
                    const activeClip = videoClips.find(clip =>
                        newTime >= clip.startTime && newTime < clip.endTime
                    );

                    if (activeClip) {
                        // 2. Calculate where the video SHOULD be
                        // offset = (Current Master Time - Clip Start Time)
                        // Target Video Time = Clip Source Start + offset
                        const offset = newTime - activeClip.startTime;
                        const targetVideoTime = activeClip.sourceStart + offset;

                        // 3. Check drift / cut
                        // If the video is paused or far away, seek it.
                        // Optimization: Tolerance of ~0.1s (approx 3 frames at 30fps)
                        if (Math.abs(video.currentTime - targetVideoTime) > 0.15) {
                            video.currentTime = targetVideoTime;

                            // If video was paused (gap or just started), play it
                            if (video.paused) {
                                video.play().catch(e => console.warn("Auto-play blocked", e));
                            }
                        } else {
                            // If we are "close enough", we trust the video playback speed 
                            // BUT we must ensure it IS playing.
                            if (video.paused) {
                                video.play().catch(() => { });
                            }
                            // Speed Match (optional): video.playbackRate = 1.0;
                        }
                    } else {
                        // GAP: No clip here.
                        // Pause the video (show black or last frame?)
                        if (!video.paused) {
                            video.pause();
                        }
                        // Ideally show black screen (hide video layer opacity)
                    }
                }

                // Sync UI
                onTimeUpdate(newTime);
                return newTime;
            });
        }
        previousTimeRef.current = time;
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
    }, [isPlaying, duration, videoClips, onTimeUpdate, videoRef]);

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            previousTimeRef.current = undefined;
            // Also pause video when master stops
            videoRef.current?.pause();
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, animate, videoRef]);

    const play = useCallback(() => setIsPlaying(true), []);
    const pause = useCallback(() => setIsPlaying(false), []);
    const togglePlay = useCallback(() => setIsPlaying(p => !p), []);

    // Allow external manual seeking
    const seek = useCallback((time: number) => {
        setCurrentTime(time);
        onTimeUpdate(time);

        // Manual Seek: FORCE sync video immediately for preview
        const video = videoRef.current;
        if (video) {
            const activeClip = videoClips.find(clip =>
                time >= clip.startTime && time < clip.endTime
            );
            if (activeClip) {
                const targetVideoTime = activeClip.sourceStart + (time - activeClip.startTime);
                video.currentTime = targetVideoTime;
            } else {
                // In gap
                // video.pause();
            }
        }
    }, [videoClips, onTimeUpdate, videoRef]);

    return {
        isPlaying,
        play,
        pause,
        togglePlay,
        seek,
        currentTime
    };
}
