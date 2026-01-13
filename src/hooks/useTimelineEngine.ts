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
                    // 1. Find which clip we are in (Layer 0 priority)
                    const activeClip = videoClips.find(clip =>
                        newTime >= clip.startTime &&
                        newTime < clip.endTime &&
                        (clip.layer === 0 || clip.layer === undefined)
                    );

                    if (activeClip) {
                        // 1.5 CHECK SOURCE
                        // Dynamic Source Switching: If src changed, load new source
                        if (activeClip.src && video.src !== activeClip.src) {
                            // Only switch if different (avoid reload loops)
                            // Check if current src is relative or different
                            const currentSrc = video.currentSrc || video.src;
                            // Need loose check or exact check.
                            if (!currentSrc.endsWith(activeClip.src) && currentSrc !== activeClip.src) {
                                console.log('[Engine] Switching Source:', activeClip.src);
                                video.src = activeClip.src;
                                // After changing src, we MUST wait for metadata or just seek?
                                // Usually setting src resets everything.
                                // We rely on the seek logic below to set time.
                            }
                        }

                        // 2. Calculate where the video SHOULD be
                        // offset = (Current Master Time - Clip Start Time)
                        // Target Video Time = Clip Source Start + offset
                        const offset = newTime - activeClip.startTime;
                        const targetVideoTime = activeClip.sourceStart + offset;

                        // 3. Check drift / cut
                        // If the video is paused or far away, seek it.
                        // Optimization: Tolerance of ~0.1s (approx 3 frames at 30fps)
                        // Also check if we just switched source (readyState might be 0)
                        if (Math.abs(video.currentTime - targetVideoTime) > 0.15 || video.readyState < 2) {
                            // Safe seek
                            try {
                                video.currentTime = targetVideoTime;
                            } catch (e) { /* ignore seek before ready */ }

                            // If video was paused (gap or just started), play it
                            if (video.paused && video.readyState >= 3) {
                                video.play().catch(e => console.warn("Auto-play blocked", e));
                            }
                        } else {
                            // If we are "close enough", we trust the video playback speed 
                            // BUT we must ensure it IS playing.
                            if (video.paused && video.readyState >= 3) {
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
