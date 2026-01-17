import { useEffect, useRef, useState, useCallback } from 'react';

// =========================================================
// Types
// =========================================================

interface VideoClip {
    id: string;
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    src?: string;
    layer?: number;
    hasAudio?: boolean;
    volume?: number;
}

interface UseTimelineEngineProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    videoClips: VideoClip[];
    onTimeUpdate: (time: number) => void;
    duration: number;
    shouldMuteVideo?: boolean;
}

// =========================================================
// State Machine Definition
// =========================================================

type EngineState =
    | 'PAUSED'           // Not playing, video paused
    | 'PLAYING_CLIP'     // Playing video content
    | 'PLAYING_GAP'      // Playing through gap (timer-driven)
    | 'SCRUBBING'        // User is scrubbing timeline
    | 'TRANSITIONING';   // Transitioning between gap→clip or clip→clip

interface GapPlaybackState {
    intervalId: NodeJS.Timeout | null;
    nextClip: VideoClip | null;
    startWallTime: number;
    gapStartTime: number;
    preSeekDone: boolean;
}

// =========================================================
// Helpers
// =========================================================

function getProxiedUrl(src: string | undefined): string {
    if (!src) return '';
    return src.startsWith('http')
        ? `/api/proxy-video?url=${encodeURIComponent(src)}`
        : src;
}

function isSameSource(currentSrc: string, targetSrc: string): boolean {
    if (!currentSrc || !targetSrc) return false;

    const extractOriginal = (url: string): string => {
        if (url.includes('/api/proxy-video?url=')) {
            const match = url.match(/url=([^&]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return url;
    };

    const original1 = extractOriginal(currentSrc);
    const original2 = extractOriginal(targetSrc);

    try {
        const url1 = new URL(original1);
        const url2 = new URL(original2);
        return url1.pathname === url2.pathname;
    } catch {
        return original1 === original2;
    }
}

function videoTimeToTimelineTime(videoTime: number, clip: VideoClip): number {
    return clip.startTime + (videoTime - clip.sourceStart);
}

function timelineTimeToVideoTime(timelineTime: number, clip: VideoClip): number {
    return clip.sourceStart + (timelineTime - clip.startTime);
}

// =========================================================
// Main Hook
// =========================================================

export function useTimelineEngine({
    videoRef,
    videoClips,
    onTimeUpdate,
    duration,
    shouldMuteVideo = false
}: UseTimelineEngineProps) {
    // -------------------------
    // Public State (exposed to UI)
    // -------------------------
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);

    // -------------------------
    // State Machine
    // -------------------------
    const engineStateRef = useRef<EngineState>('PAUSED');
    const activeClipRef = useRef<VideoClip | null>(null);
    const wasPlayingBeforeScrubRef = useRef(false);

    // Gap playback state
    const gapPlaybackRef = useRef<GapPlaybackState>({
        intervalId: null,
        nextClip: null,
        startWallTime: 0,
        gapStartTime: 0,
        preSeekDone: false
    });

    // -------------------------
    // State Transition Helpers
    // -------------------------
    const transitionTo = useCallback((newState: EngineState) => {
        const oldState = engineStateRef.current;
        if (oldState === newState) return;

        console.log(`[Engine] State: ${oldState} → ${newState}`);
        engineStateRef.current = newState;
    }, []);

    const clearGapTimer = useCallback(() => {
        if (gapPlaybackRef.current.intervalId) {
            clearInterval(gapPlaybackRef.current.intervalId);
            gapPlaybackRef.current.intervalId = null;
            gapPlaybackRef.current.nextClip = null;
            gapPlaybackRef.current.preSeekDone = false;
        }
    }, []);

    // -------------------------
    // Find Active Clip
    // -------------------------
    const findActiveClip = useCallback((time: number): VideoClip | null => {
        return videoClips.find(clip =>
            time >= clip.startTime && time < clip.endTime &&
            (clip.layer === 0 || clip.layer === undefined)
        ) || null;
    }, [videoClips]);

    // -------------------------
    // Find Next Clip After Time
    // -------------------------
    const findNextClip = useCallback((time: number): VideoClip | null => {
        return videoClips
            .filter(c => c.startTime > time && (c.layer === 0 || c.layer === undefined))
            .sort((a, b) => a.startTime - b.startTime)[0] || null;
    }, [videoClips]);

    // -------------------------
    // Start Video Playback (helper)
    // -------------------------
    const startVideoPlayback = useCallback((clip: VideoClip, video: HTMLVideoElement) => {
        const currentSrc = video.currentSrc || video.src;
        const needsSourceSwitch = !isSameSource(currentSrc, clip.src || '');

        if (needsSourceSwitch && clip.src) {
            video.src = getProxiedUrl(clip.src);
        }

        const doPlay = () => {
            video.muted = shouldMuteVideo || (clip.hasAudio === false);
            video.volume = clip.hasAudio === false ? 0 : Math.min(1, Math.max(0, clip.volume ?? 1.0));

            video.play()
                .then(() => {
                    transitionTo('PLAYING_CLIP');
                })
                .catch((e) => {
                    console.warn('[Engine] Play failed:', e);
                    transitionTo('PLAYING_CLIP'); // Still transition - timeupdate will handle sync
                });
        };

        // If video is ready, play immediately
        if (!needsSourceSwitch && video.readyState >= 3) {
            video.currentTime = clip.sourceStart;
            requestAnimationFrame(() => {
                requestAnimationFrame(doPlay);
            });
        } else {
            // Wait for video to be ready
            let started = false;
            const onReady = () => {
                if (started) return;
                started = true;
                video.removeEventListener('seeked', onReady);
                video.removeEventListener('canplay', onReady);
                video.removeEventListener('loadeddata', onReady);
                setTimeout(doPlay, 30);
            };

            video.addEventListener('seeked', onReady, { once: true });
            video.addEventListener('canplay', onReady, { once: true });
            video.addEventListener('loadeddata', onReady, { once: true });

            video.currentTime = clip.sourceStart;

            // Fallback timeout
            setTimeout(() => {
                if (!started) {
                    video.removeEventListener('seeked', onReady);
                    video.removeEventListener('canplay', onReady);
                    video.removeEventListener('loadeddata', onReady);
                    started = true;
                    doPlay();
                }
            }, 200);
        }
    }, [shouldMuteVideo, transitionTo]);

    // -------------------------
    // Start Gap Playback
    // -------------------------
    const startGapPlayback = useCallback((fromTime: number, nextClip: VideoClip, video: HTMLVideoElement) => {
        clearGapTimer();

        transitionTo('PLAYING_GAP');
        activeClipRef.current = null;

        // Keep video silent during gap
        video.pause();
        video.muted = true;
        video.volume = 0;

        const gapState = gapPlaybackRef.current;
        gapState.startWallTime = performance.now();
        gapState.gapStartTime = fromTime;
        gapState.nextClip = nextClip;
        gapState.preSeekDone = false;

        console.log('[Engine] Gap playback: from', fromTime, 'to clip at', nextClip.startTime);

        gapState.intervalId = setInterval(() => {
            const state = engineStateRef.current;

            // Only process if still in gap playback mode
            if (state !== 'PLAYING_GAP' && state !== 'TRANSITIONING') {
                clearGapTimer();
                return;
            }

            const elapsed = (performance.now() - gapState.startWallTime) / 1000;
            const newTime = gapState.gapStartTime + elapsed;

            // Always update timeline position
            setCurrentTime(newTime);
            onTimeUpdate(newTime);

            // Pre-seek: 0.5s before gap ends
            const preSeekTime = 0.5;
            if (!gapState.preSeekDone && newTime >= nextClip.startTime - preSeekTime && nextClip.src) {
                gapState.preSeekDone = true;

                const currentSrc = video.currentSrc || video.src;
                const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);

                if (needsSourceSwitch) {
                    video.src = getProxiedUrl(nextClip.src);
                }
                video.currentTime = nextClip.sourceStart;
                console.log('[Engine] Pre-seeking to:', nextClip.sourceStart);
            }

            // Reached next clip
            if (newTime >= nextClip.startTime) {
                transitionTo('TRANSITIONING');

                console.log('[Engine] Gap ended, starting clip at:', nextClip.startTime);

                activeClipRef.current = nextClip;

                // Set mute/volume and play
                video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                video.volume = nextClip.hasAudio === false ? 0 : 1;

                video.play()
                    .then(() => {
                        // Keep gap timer running briefly for smooth handoff
                        setTimeout(() => {
                            clearGapTimer();
                            transitionTo('PLAYING_CLIP');
                        }, 150);
                    })
                    .catch(() => {
                        clearGapTimer();
                        transitionTo('PLAYING_CLIP');
                    });
            }
        }, 16); // ~60fps
    }, [clearGapTimer, onTimeUpdate, shouldMuteVideo, transitionTo]);

    // =========================================================
    // Video Event Handlers
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const state = engineStateRef.current;
            const videoTime = video.currentTime;
            const clip = activeClipRef.current;

            // Skip during scrubbing
            if (state === 'SCRUBBING') return;

            // Skip during gap playback (gap timer handles time updates)
            if (state === 'PLAYING_GAP') {
                video.muted = true;
                video.volume = 0;
                return;
            }

            // Skip during transition (gap timer still running)
            if (state === 'TRANSITIONING') return;

            // Skip if paused and no explicit seek
            if (state === 'PAUSED' && video.paused) return;

            if (!clip) {
                // No active clip but not in gap mode - this shouldn't happen during playback
                if (!video.paused) {
                    video.muted = true;
                    video.pause();
                    setIsPlaying(false);
                    transitionTo('PAUSED');
                }
                return;
            }

            // Convert video time to timeline time
            const timelineTime = videoTimeToTimelineTime(videoTime, clip);

            // Check if we've reached the end of this clip
            const pastClipEnd = timelineTime >= clip.endTime || videoTime >= clip.sourceEnd;

            if (pastClipEnd) {
                console.log('[Engine] Clip end at:', timelineTime);

                // Stop video immediately
                video.pause();
                video.muted = true;
                video.volume = 0;

                // Find next clip
                const nextClip = videoClips
                    .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                    .sort((a, b) => a.startTime - b.startTime)[0];

                if (nextClip) {
                    const gapDuration = nextClip.startTime - clip.endTime;

                    if (gapDuration > 0.1) {
                        // Gap detected - switch to gap playback
                        const gapCurrentTime = Math.max(clip.endTime, timelineTime);
                        setCurrentTime(gapCurrentTime);
                        onTimeUpdate(gapCurrentTime);
                        startGapPlayback(gapCurrentTime, nextClip, video);
                    } else {
                        // No significant gap - seamless transition
                        transitionTo('TRANSITIONING');
                        activeClipRef.current = nextClip;
                        setCurrentTime(nextClip.startTime);
                        onTimeUpdate(nextClip.startTime);
                        startVideoPlayback(nextClip, video);
                    }
                } else {
                    // No more clips - end of timeline
                    console.log('[Engine] End of timeline');
                    transitionTo('PAUSED');
                    setIsPlaying(false);
                    setCurrentTime(clip.endTime);
                    onTimeUpdate(clip.endTime);
                }
            } else {
                // Normal playback - update timeline position
                if (!video.paused) {
                    setCurrentTime(timelineTime);
                    onTimeUpdate(timelineTime);
                }
            }
        };

        const handleEnded = () => {
            const clip = activeClipRef.current;
            if (!clip) return;

            // Mute immediately
            video.muted = true;
            video.volume = 0;

            // Find next clip
            const nextClip = videoClips
                .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                .sort((a, b) => a.startTime - b.startTime)[0];

            if (nextClip) {
                const gapDuration = nextClip.startTime - clip.endTime;

                if (gapDuration > 0.1) {
                    setCurrentTime(clip.endTime);
                    onTimeUpdate(clip.endTime);
                    startGapPlayback(clip.endTime, nextClip, video);
                } else {
                    transitionTo('TRANSITIONING');
                    activeClipRef.current = nextClip;
                    setCurrentTime(nextClip.startTime);
                    onTimeUpdate(nextClip.startTime);
                    startVideoPlayback(nextClip, video);
                }
            } else {
                transitionTo('PAUSED');
                setIsPlaying(false);
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
        };
    }, [videoRef, videoClips, onTimeUpdate, transitionTo, startGapPlayback, startVideoPlayback]);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearGapTimer();
    }, [clearGapTimer]);

    // =========================================================
    // Mute/Volume Sync Effect
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const state = engineStateRef.current;

        // Skip sync during gap or transition (handled elsewhere)
        if (state === 'PLAYING_GAP' || state === 'TRANSITIONING') return;

        const clip = activeClipRef.current;
        if (!clip) {
            // In gap - ensure muted
            if (gapPlaybackRef.current.intervalId) {
                video.muted = true;
                video.volume = 0;
            }
            return;
        }

        // Apply mute settings
        const shouldMute = shouldMuteVideo || (clip.hasAudio === false);
        video.muted = shouldMute;

        if (clip.hasAudio === false) {
            video.volume = 0;
        } else {
            video.volume = Math.min(1, Math.max(0, clip.volume ?? 1.0));
        }
    }, [videoRef, shouldMuteVideo, currentTime, videoClips]);

    // =========================================================
    // Public API
    // =========================================================

    const play = useCallback(() => {
        const state = engineStateRef.current;
        console.log('[Engine] play() called, state:', state, 'time:', currentTime);

        // Reset scrubbing if active
        if (state === 'SCRUBBING') {
            setIsScrubbing(false);
        }

        const video = videoRef.current;
        if (!video) return;

        // Find clip at current position
        const clip = findActiveClip(currentTime);
        activeClipRef.current = clip;

        if (clip?.src) {
            // We're on a clip - start video playback
            transitionTo('TRANSITIONING');
            setIsPlaying(true);

            const currentSrc = video.currentSrc || video.src;
            const needsSourceSwitch = !currentSrc || !isSameSource(currentSrc, clip.src);

            if (needsSourceSwitch) {
                video.src = getProxiedUrl(clip.src);
                const targetVideoTime = timelineTimeToVideoTime(currentTime, clip);
                video.currentTime = Math.max(0, targetVideoTime);
            }

            video.muted = shouldMuteVideo || (clip.hasAudio === false);

            video.play()
                .then(() => transitionTo('PLAYING_CLIP'))
                .catch(() => transitionTo('PLAYING_CLIP'));
        } else {
            // We're in a gap - find next clip and start gap playback
            const nextClip = findNextClip(currentTime);

            if (nextClip) {
                setIsPlaying(true);
                startGapPlayback(currentTime, nextClip, video);
            }
            // No next clip = at end of timeline, don't do anything
        }
    }, [videoRef, currentTime, findActiveClip, findNextClip, shouldMuteVideo, transitionTo, startGapPlayback]);

    const pause = useCallback(() => {
        console.log('[Engine] pause() called');
        const video = videoRef.current;

        clearGapTimer();

        // Sync time before pausing
        if (video && activeClipRef.current) {
            const syncedTime = videoTimeToTimelineTime(video.currentTime, activeClipRef.current);
            setCurrentTime(syncedTime);
            onTimeUpdate(syncedTime);
        }

        transitionTo('PAUSED');
        setIsPlaying(false);
        video?.pause();
    }, [videoRef, onTimeUpdate, clearGapTimer, transitionTo]);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    const startScrub = useCallback(() => {
        console.log('[Engine] startScrub(), wasPlaying:', isPlaying);
        wasPlayingBeforeScrubRef.current = isPlaying;

        clearGapTimer();
        transitionTo('SCRUBBING');
        setIsScrubbing(true);

        if (isPlaying) {
            videoRef.current?.pause();
            setIsPlaying(false);
        }
    }, [isPlaying, videoRef, clearGapTimer, transitionTo]);

    const endScrub = useCallback(() => {
        console.log('[Engine] endScrub(), resuming:', wasPlayingBeforeScrubRef.current);
        transitionTo('PAUSED');
        setIsScrubbing(false);

        if (wasPlayingBeforeScrubRef.current) {
            setTimeout(() => play(), 50);
        }
        wasPlayingBeforeScrubRef.current = false;
    }, [play, transitionTo]);

    const seek = useCallback((time: number) => {
        clearGapTimer();

        // Update timeline state immediately
        setCurrentTime(time);
        onTimeUpdate(time);

        // Find clip at target time
        const clip = findActiveClip(time);
        activeClipRef.current = clip;

        // Sync video to show frame
        const video = videoRef.current;
        if (video && clip?.src) {
            const currentSrc = video.currentSrc || video.src;
            if (!isSameSource(currentSrc, clip.src)) {
                video.src = getProxiedUrl(clip.src);
            }
            video.currentTime = timelineTimeToVideoTime(time, clip);
        }
    }, [onTimeUpdate, videoRef, findActiveClip, clearGapTimer]);

    const previewFrame = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;

        const clip = findActiveClip(time);
        if (!clip?.src) return;

        const currentSrc = video.currentSrc || video.src;
        if (!isSameSource(currentSrc, clip.src)) {
            video.src = getProxiedUrl(clip.src);
        }

        const targetVideoTime = timelineTimeToVideoTime(time, clip);
        if ('fastSeek' in video && typeof video.fastSeek === 'function') {
            video.fastSeek(targetVideoTime);
        } else {
            video.currentTime = targetVideoTime;
        }
    }, [videoRef, findActiveClip]);

    // Expose gap/transition state for TimelineEditor
    const isInGapOrTransition =
        engineStateRef.current === 'PLAYING_GAP' ||
        engineStateRef.current === 'TRANSITIONING';

    return {
        isPlaying,
        isScrubbing,
        currentTime,
        isInGapOrTransition,
        play,
        pause,
        togglePlay,
        seek,
        startScrub,
        endScrub,
        previewFrame
    };
}
