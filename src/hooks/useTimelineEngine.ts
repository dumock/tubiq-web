import { useEffect, useRef, useState, useCallback } from 'react';

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

// Helper: Convert video time to timeline time
function videoTimeToTimelineTime(videoTime: number, clip: VideoClip): number {
    return clip.startTime + (videoTime - clip.sourceStart);
}

// Helper: Convert timeline time to video time
function timelineTimeToVideoTime(timelineTime: number, clip: VideoClip): number {
    return clip.sourceStart + (timelineTime - clip.startTime);
}

export function useTimelineEngine({ videoRef, videoClips, onTimeUpdate, duration, shouldMuteVideo = false }: UseTimelineEngineProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);

    // Track if we were playing before scrub started
    const wasPlayingBeforeScrub = useRef(false);

    // Track current active clip for time conversion
    const activeClipRef = useRef<VideoClip | null>(null);

    // Track when seek is in progress to prevent timeUpdate conflicts
    const isSeekingRef = useRef(false);

    // Track scrubbing state with ref to avoid closure issues
    const isScrubbingRef = useRef(false);

    // Track gap playback - when playing through a gap, use timer instead of video timeupdate
    const gapPlaybackRef = useRef<{ intervalId: NodeJS.Timeout | null; nextClip: VideoClip | null }>({
        intervalId: null,
        nextClip: null
    });

    // Track transition from gap to clip - prevents muting during transition
    const isTransitioningFromGapRef = useRef(false);

    // Find the active clip at a given timeline time
    const findActiveClip = useCallback((time: number): VideoClip | null => {
        return videoClips.find(clip =>
            time >= clip.startTime && time < clip.endTime &&
            (clip.layer === 0 || clip.layer === undefined)
        ) || null;
    }, [videoClips]);

    // =========================================================
    // HYBRID MODE: Video timeupdate drives timeline during playback
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const videoTime = video.currentTime;
            const clip = activeClipRef.current;

            // DEBUG: Log every timeupdate
            console.log('[Engine] timeupdate fired. videoTime:', videoTime.toFixed(2),
                'paused:', video.paused, 'scrubbing:', isScrubbingRef.current,
                'clip:', clip?.id, 'clipEnd:', clip?.endTime?.toFixed(2));

            // Skip if scrubbing (use ref for real-time value)
            if (isScrubbingRef.current) return;

            // Skip if seeking (prevent jitter during click-to-seek)
            if (isSeekingRef.current) return;

            if (clip) {
                // Convert video time to timeline time
                const timelineTime = videoTimeToTimelineTime(videoTime, clip);

                // Check if we've reached the end of this clip (check both source and timeline time)
                // IMPORTANT: Check this BEFORE video.paused to handle natural video end
                const pastClipEnd = timelineTime >= clip.endTime || videoTime >= clip.sourceEnd;

                if (pastClipEnd) {
                    console.log('[Engine] CLIP END DETECTED - pausing video. timelineTime:', timelineTime, 'clip.endTime:', clip.endTime);

                    // FORCE STOP - pause immediately and mute
                    video.pause();
                    video.muted = true;
                    video.volume = 0;

                    // Find next clip that starts after this one (handle gaps)
                    const nextClip = videoClips
                        .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                        .sort((a, b) => a.startTime - b.startTime)[0];

                    if (nextClip) {
                        // Check if there's a gap between clips
                        const gapDuration = nextClip.startTime - clip.endTime;

                        if (gapDuration > 0.1) {
                            // There's a significant gap - play through it with silence
                            console.log('[Engine] Gap detected:', gapDuration, 'seconds. Playing through gap with silence.');

                            // Keep video paused and silent during gap
                            // Video is already paused and muted from earlier in this function

                            // Clear active clip since we're in a gap
                            activeClipRef.current = null;

                            // SMOOTH TRANSITION: Use current timelineTime instead of jumping back to clip.endTime
                            // This prevents playhead from jumping backwards
                            const gapElapsed = Math.max(0, timelineTime - clip.endTime);
                            const gapCurrentTime = timelineTime; // Keep current position
                            setCurrentTime(gapCurrentTime);
                            onTimeUpdate(gapCurrentTime);

                            // Clear any existing gap interval
                            if (gapPlaybackRef.current.intervalId) {
                                clearInterval(gapPlaybackRef.current.intervalId);
                            }

                            // Use timer to advance timeline through the gap (simulate playback at ~60fps)
                            // Adjust startWallTime to account for already elapsed gap time
                            const startWallTime = performance.now() - (gapElapsed * 1000);
                            const gapStartTime = clip.endTime; // Use actual gap start for accurate timing

                            gapPlaybackRef.current.nextClip = nextClip;
                            let preSeekDone = false; // Flag for pre-seeking before gap ends
                            let transitionStarted = false; // Flag to prevent multiple transition triggers

                            gapPlaybackRef.current.intervalId = setInterval(() => {
                                const elapsed = (performance.now() - startWallTime) / 1000;
                                const newTime = gapStartTime + elapsed;

                                // Always update timeline position (keeps playhead moving during transition)
                                setCurrentTime(newTime);
                                onTimeUpdate(newTime);

                                // PRE-SEEK: 0.5s before gap ends, seek video to next clip position
                                // This way the video frame is already decoded when we need to play
                                const preSeekTime = 0.5;
                                if (!preSeekDone && newTime >= nextClip.startTime - preSeekTime && nextClip.src) {
                                    preSeekDone = true;
                                    const currentSrc = video.currentSrc || video.src;
                                    const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);

                                    if (needsSourceSwitch) {
                                        video.src = getProxiedUrl(nextClip.src);
                                    }
                                    video.currentTime = nextClip.sourceStart;
                                    console.log('[Engine] Pre-seeking to next clip position:', nextClip.sourceStart);
                                }

                                if (newTime >= nextClip.startTime && !transitionStarted) {
                                    // Reached the next clip - video should already be seeked, just play
                                    transitionStarted = true;

                                    console.log('[Engine] Gap ended, playing next clip:', nextClip.startTime);

                                    // Mark as transitioning to prevent mute sync from interfering
                                    isTransitioningFromGapRef.current = true;

                                    // Set up next clip
                                    activeClipRef.current = nextClip;

                                    // Start video playback immediately (already pre-seeked)
                                    video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                    video.volume = 1;

                                    video.play().then(() => {
                                        // Keep gap timer running briefly to ensure smooth handoff
                                        // Video timeupdate needs a moment to catch up
                                        setTimeout(() => {
                                            if (gapPlaybackRef.current.intervalId) {
                                                clearInterval(gapPlaybackRef.current.intervalId);
                                                gapPlaybackRef.current.intervalId = null;
                                            }
                                            isTransitioningFromGapRef.current = false;
                                        }, 150); // 150ms grace period for smooth handoff
                                    }).catch(() => {
                                        // Still stop timer on error
                                        if (gapPlaybackRef.current.intervalId) {
                                            clearInterval(gapPlaybackRef.current.intervalId);
                                            gapPlaybackRef.current.intervalId = null;
                                        }
                                        isTransitioningFromGapRef.current = false;
                                    });
                                }
                            }, 16); // ~60fps
                        } else {
                            // No significant gap - seamless transition
                            console.log('[Engine] Seamless transition to next clip at:', nextClip.startTime);
                            isTransitioningFromGapRef.current = true;
                            activeClipRef.current = nextClip;
                            if (nextClip.src) {
                                const currentSrc = video.currentSrc || video.src;
                                const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);
                                if (needsSourceSwitch) {
                                    video.src = getProxiedUrl(nextClip.src);
                                }

                                // Set mute/volume AFTER ensuring video will play
                                const startPlayback = () => {
                                    video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                    video.volume = 1;
                                    video.play().then(() => {
                                        isTransitioningFromGapRef.current = false;
                                    }).catch(() => {
                                        isTransitioningFromGapRef.current = false;
                                    });
                                };

                                let playbackStarted = false;

                                // Wait for video to be ready before playing
                                const playWhenReady = () => {
                                    if (playbackStarted) return;
                                    playbackStarted = true;
                                    video.removeEventListener('seeked', playWhenReady);
                                    video.removeEventListener('canplay', playWhenReady);
                                    video.removeEventListener('loadeddata', playWhenReady);
                                    setTimeout(startPlayback, 30);
                                };

                                // If video is already ready and we're not switching source, play faster
                                if (!needsSourceSwitch && video.readyState >= 3) {
                                    video.currentTime = nextClip.sourceStart;
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            if (!playbackStarted) {
                                                playbackStarted = true;
                                                startPlayback();
                                            }
                                        });
                                    });
                                } else {
                                    video.addEventListener('seeked', playWhenReady, { once: true });
                                    video.addEventListener('canplay', playWhenReady, { once: true });
                                    video.addEventListener('loadeddata', playWhenReady, { once: true });

                                    video.currentTime = nextClip.sourceStart;

                                    // Fallback timeout
                                    setTimeout(() => {
                                        if (!playbackStarted) {
                                            video.removeEventListener('seeked', playWhenReady);
                                            video.removeEventListener('canplay', playWhenReady);
                                            video.removeEventListener('loadeddata', playWhenReady);
                                            playbackStarted = true;
                                            startPlayback();
                                        }
                                    }, 200);
                                }
                            }
                            setCurrentTime(nextClip.startTime);
                            onTimeUpdate(nextClip.startTime);
                        }
                    } else {
                        // No more clips - end of timeline
                        console.log('[Engine] No more clips - stopping playback');
                        setIsPlaying(false);
                        setCurrentTime(clip.endTime);
                        onTimeUpdate(clip.endTime);
                    }
                } else {
                    // Normal playback - update timeline position (only if video is playing)
                    if (!video.paused) {
                        setCurrentTime(timelineTime);
                        onTimeUpdate(timelineTime);
                    }
                }
            } else {
                // No active clip at current time - we're in a gap
                // If gap playback timer is already running, let it handle the gap - don't interfere
                if (gapPlaybackRef.current.intervalId) {
                    // Gap timer is active - just ensure video stays muted/paused
                    video.muted = true;
                    video.volume = 0;
                    // Don't do anything else - let the gap timer handle progression
                    return;
                }

                // No gap timer running - this shouldn't happen during normal playback
                // but handle it anyway by stopping
                video.muted = true;
                video.pause();
                setIsPlaying(false);
            }
        };

        // Handle video ended
        const handleEnded = () => {
            const clip = activeClipRef.current;
            if (clip) {
                // Immediately mute to prevent any audio leakage
                video.muted = true;
                video.volume = 0;

                // Check for next clip (handle gaps)
                const nextClip = videoClips
                    .filter(c => c.startTime >= clip.endTime && (c.layer === 0 || c.layer === undefined))
                    .sort((a, b) => a.startTime - b.startTime)[0];

                if (nextClip) {
                    const gapDuration = nextClip.startTime - clip.endTime;

                    if (gapDuration > 0.1) {
                        // There's a gap - play through it with silence (same logic as timeupdate)
                        console.log('[Engine] handleEnded - Gap detected:', gapDuration, 'seconds');

                        activeClipRef.current = null;
                        let gapCurrentTime = clip.endTime;
                        setCurrentTime(gapCurrentTime);
                        onTimeUpdate(gapCurrentTime);

                        if (gapPlaybackRef.current.intervalId) {
                            clearInterval(gapPlaybackRef.current.intervalId);
                        }

                        const startWallTime = performance.now();
                        const gapStartTime = gapCurrentTime;

                        gapPlaybackRef.current.nextClip = nextClip;
                        gapPlaybackRef.current.intervalId = setInterval(() => {
                            const elapsed = (performance.now() - startWallTime) / 1000;
                            const newTime = gapStartTime + elapsed;

                            if (newTime >= nextClip.startTime) {
                                if (gapPlaybackRef.current.intervalId) {
                                    clearInterval(gapPlaybackRef.current.intervalId);
                                    gapPlaybackRef.current.intervalId = null;
                                }

                                // Mark as transitioning
                                isTransitioningFromGapRef.current = true;

                                // Use smoothTime to prevent jump back
                                activeClipRef.current = nextClip;
                                const smoothTime = Math.max(nextClip.startTime, Math.min(newTime, nextClip.startTime + 0.1));
                                setCurrentTime(smoothTime);
                                onTimeUpdate(smoothTime);

                                if (nextClip.src) {
                                    const currentSrc = video.currentSrc || video.src;
                                    const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);
                                    if (needsSourceSwitch) {
                                        video.src = getProxiedUrl(nextClip.src);
                                    }

                                    // Set mute/volume AFTER ensuring video will play
                                    const startPlayback = () => {
                                        video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                        video.volume = 1;
                                        video.play().then(() => {
                                            isTransitioningFromGapRef.current = false;
                                        }).catch(() => {
                                            isTransitioningFromGapRef.current = false;
                                        });
                                    };

                                    let playbackStarted = false;

                                    // Wait for video to be ready before playing
                                    const playWhenReady = () => {
                                        if (playbackStarted) return;
                                        playbackStarted = true;
                                        video.removeEventListener('seeked', playWhenReady);
                                        video.removeEventListener('canplay', playWhenReady);
                                        video.removeEventListener('loadeddata', playWhenReady);
                                        setTimeout(startPlayback, 30);
                                    };

                                    if (!needsSourceSwitch && video.readyState >= 3) {
                                        video.currentTime = nextClip.sourceStart;
                                        requestAnimationFrame(() => {
                                            requestAnimationFrame(() => {
                                                if (!playbackStarted) {
                                                    playbackStarted = true;
                                                    startPlayback();
                                                }
                                            });
                                        });
                                    } else {
                                        video.addEventListener('seeked', playWhenReady, { once: true });
                                        video.addEventListener('canplay', playWhenReady, { once: true });
                                        video.addEventListener('loadeddata', playWhenReady, { once: true });

                                        video.currentTime = nextClip.sourceStart;

                                        // Fallback timeout
                                        setTimeout(() => {
                                            if (!playbackStarted) {
                                                video.removeEventListener('seeked', playWhenReady);
                                                video.removeEventListener('canplay', playWhenReady);
                                                video.removeEventListener('loadeddata', playWhenReady);
                                                playbackStarted = true;
                                                startPlayback();
                                            }
                                        }, 200);
                                    }
                                }
                            } else {
                                setCurrentTime(newTime);
                                onTimeUpdate(newTime);
                            }
                        }, 16);
                    } else {
                        // No significant gap - seamless transition
                        isTransitioningFromGapRef.current = true;
                        activeClipRef.current = nextClip;
                        if (nextClip.src) {
                            const currentSrc = video.currentSrc || video.src;
                            const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);
                            if (needsSourceSwitch) {
                                video.src = getProxiedUrl(nextClip.src);
                            }

                            // Set mute/volume AFTER ensuring video will play
                            const startPlayback = () => {
                                video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                video.volume = 1;
                                video.play().then(() => {
                                    isTransitioningFromGapRef.current = false;
                                }).catch(() => {
                                    isTransitioningFromGapRef.current = false;
                                });
                            };

                            let playbackStarted = false;

                            // Wait for video to be ready before playing
                            const playWhenReady = () => {
                                if (playbackStarted) return;
                                playbackStarted = true;
                                video.removeEventListener('seeked', playWhenReady);
                                video.removeEventListener('canplay', playWhenReady);
                                video.removeEventListener('loadeddata', playWhenReady);
                                setTimeout(startPlayback, 30);
                            };

                            if (!needsSourceSwitch && video.readyState >= 3) {
                                video.currentTime = nextClip.sourceStart;
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        if (!playbackStarted) {
                                            playbackStarted = true;
                                            startPlayback();
                                        }
                                    });
                                });
                            } else {
                                video.addEventListener('seeked', playWhenReady, { once: true });
                                video.addEventListener('canplay', playWhenReady, { once: true });
                                video.addEventListener('loadeddata', playWhenReady, { once: true });

                                video.currentTime = nextClip.sourceStart;

                                // Fallback timeout
                                setTimeout(() => {
                                    if (!playbackStarted) {
                                        video.removeEventListener('seeked', playWhenReady);
                                        video.removeEventListener('canplay', playWhenReady);
                                        video.removeEventListener('loadeddata', playWhenReady);
                                        playbackStarted = true;
                                        startPlayback();
                                    }
                                }, 200);
                            }
                        }
                        setCurrentTime(nextClip.startTime);
                        onTimeUpdate(nextClip.startTime);
                    }
                } else {
                    setIsPlaying(false);
                }
            }
        };

        // Attach listeners
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            // NOTE: Don't clear gap interval here - it would be cleared on every re-render
            // Gap interval cleanup is handled by pause/seek/scrub functions and unmount effect
        };
    }, [videoRef, isScrubbing, videoClips, onTimeUpdate, findActiveClip, shouldMuteVideo]);

    // Separate cleanup effect for gap interval on unmount only
    useEffect(() => {
        return () => {
            if (gapPlaybackRef.current.intervalId) {
                clearInterval(gapPlaybackRef.current.intervalId);
                gapPlaybackRef.current.intervalId = null;
            }
        };
    }, []); // Empty deps = only runs on unmount

    // =========================================================
    // Mute state and volume sync
    // =========================================================
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // CRITICAL: Skip all mute sync during gap→clip transition
        // This prevents the effect from re-muting the video while we're trying to play
        if (isTransitioningFromGapRef.current) {
            console.log('[DEBUG] Mute sync skipped - transitioning from gap');
            return;
        }

        // Use activeClipRef instead of findActiveClip(currentTime) to avoid race condition
        // State updates are async, so currentTime may still be the gap position when this effect runs
        const clip = activeClipRef.current;

        // If we're in a gap (no clip), check if we should mute
        if (!clip) {
            // Only mute if gap playback timer is active (actually playing through gap)
            if (gapPlaybackRef.current.intervalId) {
                video.muted = true;
                video.volume = 0;
            }
            // Don't pause here if gap playback timer is active (it's handling the gap)
            return;
        }

        // Mute if: globally muted OR current clip has no audio (was separated)
        const shouldMute = shouldMuteVideo || (clip.hasAudio === false);
        video.muted = shouldMute;

        // Also set volume to 0 as backup when audio is separated (redundant safety)
        if (clip.hasAudio === false) {
            video.volume = 0;
        } else {
            // Sync volume (0-2 range to 0-1 clamped)
            const clipVolume = clip.volume ?? 1.0;
            video.volume = Math.min(1, Math.max(0, clipVolume));
        }
    }, [videoRef, shouldMuteVideo, currentTime, videoClips]);

    // =========================================================
    // Play / Pause / Toggle
    // =========================================================
    const play = useCallback(() => {
        console.log('[Hybrid Engine] play() called, currentTime:', currentTime);

        // CRITICAL: Reset scrubbing state when play is called
        setIsScrubbing(false);
        isScrubbingRef.current = false;

        const video = videoRef.current;

        // Use video's actual position if available AND we have an active clip, otherwise use state
        let playFromTime = currentTime;
        if (video && activeClipRef.current) {
            playFromTime = videoTimeToTimelineTime(video.currentTime, activeClipRef.current);
        }

        // Find active clip at the play position
        const clip = findActiveClip(playFromTime) || findActiveClip(currentTime);
        activeClipRef.current = clip;

        if (video && clip?.src) {
            // Sync source if needed
            const currentSrc = video.currentSrc || video.src;
            const needsSourceSwitch = !currentSrc || !isSameSource(currentSrc, clip.src);

            if (needsSourceSwitch) {
                video.src = getProxiedUrl(clip.src);
                // Only seek if we changed source
                const targetVideoTime = timelineTimeToVideoTime(currentTime, clip);
                video.currentTime = Math.max(0, targetVideoTime);
            }
            // If same source, just resume from current position (no seek)

            // Set mute state
            const shouldMute = shouldMuteVideo || (clip.hasAudio === false);
            video.muted = shouldMute;

            // Start playing
            video.play()
                .then(() => {
                    setIsPlaying(true);
                })
                .catch(e => {
                    console.warn('[Hybrid Engine] Auto-play blocked:', e);
                    // Still set isPlaying true - timeupdate will handle sync
                    setIsPlaying(true);
                });
        } else {
            // No clip at current position - we're in a gap
            // Find next clip and play through the gap
            const nextClip = videoClips
                .filter(c => c.startTime > currentTime && (c.layer === 0 || c.layer === undefined))
                .sort((a, b) => a.startTime - b.startTime)[0];

            if (nextClip && video) {
                // Make sure video stays paused and silent during gap
                video.pause();
                video.muted = true;
                video.volume = 0;

                // Clear active clip since we're in a gap
                activeClipRef.current = null;
                setIsPlaying(true);

                // Clear any existing gap interval
                if (gapPlaybackRef.current.intervalId) {
                    clearInterval(gapPlaybackRef.current.intervalId);
                }

                // Use timer to advance timeline through the gap
                const startWallTime = performance.now();
                const gapStartTime = currentTime;

                console.log('[Engine] Starting gap playback from:', gapStartTime, 'to next clip at:', nextClip.startTime);

                gapPlaybackRef.current.nextClip = nextClip;
                gapPlaybackRef.current.intervalId = setInterval(() => {
                    const elapsed = (performance.now() - startWallTime) / 1000;
                    const newTime = gapStartTime + elapsed;

                    if (newTime >= nextClip.startTime) {
                        // Reached the next clip - stop gap timer and resume video
                        if (gapPlaybackRef.current.intervalId) {
                            clearInterval(gapPlaybackRef.current.intervalId);
                            gapPlaybackRef.current.intervalId = null;
                        }

                        console.log('[Engine] Gap ended, resuming at next clip:', nextClip.startTime);

                        // Mark as transitioning
                        isTransitioningFromGapRef.current = true;

                        // Use smoothTime to prevent jump back
                        activeClipRef.current = nextClip;
                        const smoothTime = Math.max(nextClip.startTime, Math.min(newTime, nextClip.startTime + 0.1));
                        setCurrentTime(smoothTime);
                        onTimeUpdate(smoothTime);

                        // Start video playback - wait for seek to complete before playing
                        if (nextClip.src) {
                            const currentSrc = video.currentSrc || video.src;
                            const needsSourceSwitch = !isSameSource(currentSrc, nextClip.src);
                            if (needsSourceSwitch) {
                                video.src = getProxiedUrl(nextClip.src);
                            }

                            // Set mute/volume AFTER ensuring video will play
                            const startPlayback = () => {
                                video.muted = shouldMuteVideo || (nextClip.hasAudio === false);
                                video.volume = 1;
                                video.play().then(() => {
                                    isTransitioningFromGapRef.current = false;
                                }).catch(() => {
                                    isTransitioningFromGapRef.current = false;
                                });
                            };

                            let playbackStarted = false;

                            // Wait for video to be ready before playing
                            const playWhenReady = () => {
                                if (playbackStarted) return;
                                playbackStarted = true;
                                video.removeEventListener('seeked', playWhenReady);
                                video.removeEventListener('canplay', playWhenReady);
                                video.removeEventListener('loadeddata', playWhenReady);
                                setTimeout(startPlayback, 30);
                            };

                            if (!needsSourceSwitch && video.readyState >= 3) {
                                video.currentTime = nextClip.sourceStart;
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        if (!playbackStarted) {
                                            playbackStarted = true;
                                            startPlayback();
                                        }
                                    });
                                });
                            } else {
                                video.addEventListener('seeked', playWhenReady, { once: true });
                                video.addEventListener('canplay', playWhenReady, { once: true });
                                video.addEventListener('loadeddata', playWhenReady, { once: true });

                                video.currentTime = nextClip.sourceStart;

                                // Fallback timeout
                                setTimeout(() => {
                                    if (!playbackStarted) {
                                        video.removeEventListener('seeked', playWhenReady);
                                        video.removeEventListener('canplay', playWhenReady);
                                        video.removeEventListener('loadeddata', playWhenReady);
                                        playbackStarted = true;
                                        startPlayback();
                                    }
                                }, 200);
                            }
                        }
                    } else {
                        // Still in gap - update timeline position
                        setCurrentTime(newTime);
                        onTimeUpdate(newTime);
                    }
                }, 16); // ~60fps
            }
            // If no next clip, don't do anything (already at end)
        }
    }, [videoRef, videoClips, currentTime, shouldMuteVideo, findActiveClip, onTimeUpdate]);

    const pause = useCallback(() => {
        console.log('[Hybrid Engine] pause() called');
        const video = videoRef.current;

        // Stop any gap playback timer
        if (gapPlaybackRef.current.intervalId) {
            clearInterval(gapPlaybackRef.current.intervalId);
            gapPlaybackRef.current.intervalId = null;
            gapPlaybackRef.current.nextClip = null;
        }

        // Sync currentTime to video's actual position before pausing
        // This prevents flicker from late timeupdate events
        if (video && activeClipRef.current) {
            const syncedTime = videoTimeToTimelineTime(video.currentTime, activeClipRef.current);
            setCurrentTime(syncedTime);
            onTimeUpdate(syncedTime);
        }

        setIsPlaying(false);
        video?.pause();
    }, [videoRef, onTimeUpdate]);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    // =========================================================
    // Scrubbing Mode Control
    // =========================================================
    const startScrub = useCallback(() => {
        console.log('[Hybrid Engine] startScrub() - wasPlaying:', isPlaying);
        wasPlayingBeforeScrub.current = isPlaying;
        setIsScrubbing(true);
        isScrubbingRef.current = true; // Sync ref for closure

        // Stop any gap playback timer when scrubbing
        if (gapPlaybackRef.current.intervalId) {
            clearInterval(gapPlaybackRef.current.intervalId);
            gapPlaybackRef.current.intervalId = null;
            gapPlaybackRef.current.nextClip = null;
        }

        if (isPlaying) {
            videoRef.current?.pause();
            setIsPlaying(false);
        }
    }, [isPlaying, videoRef]);

    const endScrub = useCallback(() => {
        console.log('[Hybrid Engine] endScrub() - resuming:', wasPlayingBeforeScrub.current);
        setIsScrubbing(false);
        isScrubbingRef.current = false; // Sync ref for closure

        if (wasPlayingBeforeScrub.current) {
            // Small delay to ensure state is settled
            setTimeout(() => {
                play();
            }, 50);
        }
        wasPlayingBeforeScrub.current = false;
    }, [play]);

    // Throttle ref for seek during scrubbing
    const lastSeekTime = useRef<number>(0);
    const pendingSeek = useRef<number | null>(null);

    // =========================================================
    // Seek (used during scrubbing and click-to-seek)
    // =========================================================
    const seek = useCallback((time: number) => {
        // Stop any gap playback timer when seeking
        if (gapPlaybackRef.current.intervalId) {
            clearInterval(gapPlaybackRef.current.intervalId);
            gapPlaybackRef.current.intervalId = null;
            gapPlaybackRef.current.nextClip = null;
        }

        // Set seeking flag to prevent timeUpdate conflicts
        isSeekingRef.current = true;

        // Update timeline state immediately for responsive UI
        setCurrentTime(time);
        onTimeUpdate(time);

        // Find clip at target time and update active clip ref
        const clip = findActiveClip(time);
        activeClipRef.current = clip;

        // Sync video to show frame
        const video = videoRef.current;
        if (video && clip) {
            // Sync source if needed
            if (clip.src) {
                const currentSrc = video.currentSrc || video.src;
                if (!isSameSource(currentSrc, clip.src)) {
                    video.src = getProxiedUrl(clip.src);
                }
            }

            // Seek video to show frame - use direct currentTime for reliable updates
            const targetVideoTime = timelineTimeToVideoTime(time, clip);
            video.currentTime = targetVideoTime;
        }

        // Reset seeking flag after a short delay to allow video to settle
        setTimeout(() => {
            isSeekingRef.current = false;
        }, 50);
    }, [videoClips, onTimeUpdate, videoRef, findActiveClip, isScrubbing]);

    // =========================================================
    // Preview Frame (for trim operations - doesn't move playhead)
    // =========================================================
    const previewFrame = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;

        // Find clip at this time
        const clip = findActiveClip(time);
        if (!clip) return;

        // Sync source if needed
        if (clip.src) {
            const currentSrc = video.currentSrc || video.src;
            if (!isSameSource(currentSrc, clip.src)) {
                video.src = getProxiedUrl(clip.src);
            }
        }

        // Update video frame only (no state update, no playhead move)
        const targetVideoTime = timelineTimeToVideoTime(time, clip);
        if ('fastSeek' in video && typeof video.fastSeek === 'function') {
            video.fastSeek(targetVideoTime);
        } else {
            video.currentTime = targetVideoTime;
        }
    }, [videoRef, findActiveClip]);

    // Check if we're in a gap or transitioning (useful for TimelineEditor)
    const isInGapOrTransition = gapPlaybackRef.current.intervalId !== null || isTransitioningFromGapRef.current;

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
