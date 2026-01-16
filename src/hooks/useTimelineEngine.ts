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
    shouldMuteVideo?: boolean; // Mute video audio (e.g., when audio is separated)
}

// Helper: Apply proxy for CORS with http URLs
function getProxiedUrl(src: string | undefined): string {
    if (!src) return '';
    return src.startsWith('http')
        ? `/api/proxy-video?url=${encodeURIComponent(src)}`
        : src;
}

// Helper: Compare URLs (handles proxy vs original)
function isSameSource(currentSrc: string, targetSrc: string): boolean {
    if (!currentSrc || !targetSrc) return false;

    // Extract original URL from proxy if needed
    const extractOriginal = (url: string): string => {
        if (url.includes('/api/proxy-video?url=')) {
            const match = url.match(/url=([^&]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return url;
    };

    const original1 = extractOriginal(currentSrc);
    const original2 = extractOriginal(targetSrc);

    // Compare by pathname to handle query params differences
    try {
        const url1 = new URL(original1);
        const url2 = new URL(original2);
        return url1.pathname === url2.pathname;
    } catch {
        return original1 === original2;
    }
}

export function useTimelineEngine({ videoRef, videoClips, onTimeUpdate, duration, shouldMuteVideo = false }: UseTimelineEngineProps) {
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

                // Calculate effective duration: use max clip endTime if clips exist
                const maxClipEnd = videoClips.length > 0
                    ? Math.max(...videoClips.map(c => c.endTime))
                    : duration;
                const effectiveDuration = Math.max(duration, maxClipEnd);

                // DEBUG: Log every second
                if (Math.floor(newTime) !== Math.floor(prevTime)) {
                    console.log('[Engine] animate:', {
                        newTime: newTime.toFixed(2),
                        effectiveDuration,
                        clipCount: videoClips.length,
                        hasVideoRef: !!videoRef.current
                    });
                }

                if (newTime >= effectiveDuration && effectiveDuration > 0) {
                    console.log('[Engine] Reached end, stopping:', { newTime, effectiveDuration });
                    setIsPlaying(false);
                    return effectiveDuration; // or 0 to loop
                }

                // --- SEQUENCING LOGIC ---
                const video = videoRef.current;

                // Handle main video element ONLY if it exists (V1 has content)
                if (video) {
                    // 1. Find ALL active clips at current time (any layer)
                    const allActiveClips = videoClips.filter(clip =>
                        newTime >= clip.startTime && newTime < clip.endTime
                    );

                    // 1b. Find main video clip (Layer 0) - this controls the main video element
                    const mainClip = allActiveClips.find(clip =>
                        clip.layer === 0 || clip.layer === undefined
                    );

                    // 2. Handle main video element (Layer 0)
                    if (mainClip) {
                        // Dynamic Source Switching
                        if (mainClip.src) {
                            const currentSrc = video.currentSrc || video.src;
                            const needsSwitch = !isSameSource(currentSrc, mainClip.src);

                            if (needsSwitch) {
                                console.log('[Engine] Switching Source for clip:', mainClip.id?.substring(0, 8));
                                video.src = getProxiedUrl(mainClip.src);
                            }
                        }

                        // Calculate target time and sync
                        const offset = newTime - mainClip.startTime;
                        const targetVideoTime = mainClip.sourceStart + offset;

                        if (Math.abs(video.currentTime - targetVideoTime) > 0.15 || video.readyState < 2) {
                            try {
                                video.currentTime = targetVideoTime;
                            } catch (e) { /* ignore seek before ready */ }
                            if (video.paused && video.readyState >= 3) {
                                video.muted = shouldMuteVideo; // Apply mute before play
                                video.play().catch(e => console.warn("Auto-play blocked", e));
                            }
                        } else {
                            if (video.paused && video.readyState >= 3) {
                                video.muted = shouldMuteVideo; // Apply mute before play
                                video.play().catch(() => { });
                            }
                        }
                    } else {
                        // No main clip (V1 empty) - pause main video but KEEP TIMELINE RUNNING
                        if (!video.paused) {
                            video.pause();
                        }
                    }
                }
                // NOTE: Removed the closing brace that was blocking onTimeUpdate

                // CRITICAL: Sync UI ALWAYS - regardless of whether video element exists
                // This ensures playhead moves for V2-only, audio-only, etc.
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
        console.log('[Engine] play() called, clips:', videoClips.length);

        // Find Layer 0 (main video) clip at current time
        const mainClip = videoClips.find(clip =>
            currentTime >= clip.startTime && currentTime < clip.endTime &&
            (clip.layer === 0 || clip.layer === undefined)
        );

        const video = videoRef.current;

        // Only sync mainVideoRef if there's a Layer 0 clip AND video element exists
        if (video && mainClip?.src) {
            const currentSrc = video.currentSrc || video.src;
            const needsSwitch = !currentSrc || !isSameSource(currentSrc, mainClip.src);

            if (needsSwitch) {
                console.log('[Engine] Play: Setting main video source');
                video.src = getProxiedUrl(mainClip.src);
            }

            // Seek to correct position in the source
            const targetVideoTime = mainClip.sourceStart + (currentTime - mainClip.startTime);
            video.currentTime = Math.max(0, targetVideoTime);

            // Wait for video to be ready, then start
            if (video.readyState >= 3) {
                video.muted = shouldMuteVideo; // Apply mute before play
                video.play().catch(e => console.warn('[Engine] Auto-play blocked:', e));
                setIsPlaying(true);
            } else {
                console.log('[Engine] Waiting for main video ready...');
                const onCanPlay = () => {
                    video.removeEventListener('canplay', onCanPlay);
                    video.muted = shouldMuteVideo; // Apply mute before play
                    video.play().catch(e => console.warn('[Engine] Auto-play blocked:', e));
                    setIsPlaying(true);
                };
                video.addEventListener('canplay', onCanPlay);
                // Fallback timeout
                setTimeout(() => {
                    video.removeEventListener('canplay', onCanPlay);
                    if (!video.paused) return;
                    console.log('[Engine] Fallback: starting without canplay');
                    video.muted = shouldMuteVideo; // Apply mute before play
                    video.play().catch(() => { });
                    setIsPlaying(true);
                }, 500);
            }
        } else {
            // No Layer 0 clip or no video element - start timeline immediately for V2+/audio only
            console.log('[Engine] No main clip, starting timeline for V2+/audio');
            setIsPlaying(true);
        }
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
                time >= clip.startTime && time < clip.endTime &&
                (clip.layer === 0 || clip.layer === undefined)
            );
            if (activeClip) {
                // Check if we need to switch source
                if (activeClip.src) {
                    const currentSrc = video.currentSrc || video.src;
                    const needsSwitch = !isSameSource(currentSrc, activeClip.src);

                    if (needsSwitch) {
                        console.log('[Engine] Seek: Switching Source:', activeClip.src.substring(0, 100));
                        video.src = getProxiedUrl(activeClip.src);
                    }
                }

                const targetVideoTime = activeClip.sourceStart + (time - activeClip.startTime);
                video.currentTime = targetVideoTime;
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
