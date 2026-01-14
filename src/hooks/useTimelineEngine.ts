import { useEffect, useRef, useState, useCallback } from 'react';

interface VideoClip {
    id: string;
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    src?: string; // Optional: support multiple sources later
    layer?: number; // 0 = Main, 1+ = Overlay
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
                        if (activeClip.src) {
                            const currentSrc = video.currentSrc || video.src;
                            // Robust URL comparison - extract pathname for comparison
                            let needsSwitch = false;
                            try {
                                const currentUrl = new URL(currentSrc);
                                const targetUrl = new URL(activeClip.src);
                                // Compare pathnames (ignores query params like tokens)
                                needsSwitch = currentUrl.pathname !== targetUrl.pathname;
                            } catch {
                                // If URL parsing fails, do string comparison
                                needsSwitch = currentSrc !== activeClip.src && !currentSrc.includes(activeClip.src);
                            }

                            if (needsSwitch) {
                                console.log('[Engine] Switching Source for clip:', {
                                    clipId: activeClip.id?.substring(0, 8),
                                    startTime: activeClip.startTime,
                                    endTime: activeClip.endTime,
                                    src: activeClip.src.substring(0, 80)
                                });
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

    const play = useCallback(() => {
        // Initialize video source for the active clip at currentTime before starting
        const video = videoRef.current;
        if (video && videoClips.length > 0) {
            const activeClip = videoClips.find(clip =>
                currentTime >= clip.startTime && currentTime < clip.endTime
            ) || videoClips[0]; // Fallback to first clip

            if (activeClip?.src) {
                const currentSrc = video.currentSrc || video.src;
                let needsSwitch = !currentSrc;
                if (currentSrc && activeClip.src) {
                    try {
                        const currentUrl = new URL(currentSrc);
                        const targetUrl = new URL(activeClip.src);
                        needsSwitch = currentUrl.pathname !== targetUrl.pathname;
                    } catch {
                        needsSwitch = currentSrc !== activeClip.src;
                    }
                }

                if (needsSwitch) {
                    console.log('[Engine] Play: Initializing source:', activeClip.src.substring(0, 100));
                    video.src = activeClip.src;
                }

                // Seek to correct position in the source
                const targetVideoTime = activeClip.sourceStart + (currentTime - activeClip.startTime);
                video.currentTime = Math.max(0, targetVideoTime);

                // Start video playback
                video.play().catch(e => console.warn('[Engine] Auto-play blocked:', e));
            }
        }
        setIsPlaying(true);
    }, [videoRef, videoClips, currentTime]);
    const pause = useCallback(() => {
        setIsPlaying(false);
        videoRef.current?.pause();
    }, [videoRef]);
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

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
                // Check if we need to switch source
                if (activeClip.src) {
                    const currentSrc = video.currentSrc || video.src;
                    let needsSwitch = false;
                    try {
                        const currentUrl = new URL(currentSrc);
                        const targetUrl = new URL(activeClip.src);
                        needsSwitch = currentUrl.pathname !== targetUrl.pathname;
                    } catch {
                        needsSwitch = currentSrc !== activeClip.src && !currentSrc.includes(activeClip.src);
                    }

                    if (needsSwitch) {
                        console.log('[Engine] Seek: Switching Source:', activeClip.src.substring(0, 100));
                        video.src = activeClip.src;
                    }
                }

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
