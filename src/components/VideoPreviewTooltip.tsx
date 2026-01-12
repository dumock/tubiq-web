import React, { useRef, useEffect } from 'react';

// Video Preview Tooltip Component
const VideoPreviewTooltip = ({ src, startTime, endTime, x, y }: { src: string, startTime: number, endTime: number, x: number, y: number }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Initial Seek
        video.currentTime = startTime;

        const handleTimeUpdate = () => {
            if (video.currentTime >= endTime) {
                video.pause();
                // video.currentTime = startTime; // Optional: Reset to start if preferred, but user just said "play once"
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);

        const playVideo = async () => {
            try {
                await video.play();
            } catch (error) {
                // Ignore AbortError which happens on rapid cleanup
                if ((error as Error).name !== 'AbortError') {
                    console.log("Auto-play prevented", error);
                }
            }
        };

        playVideo();

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.pause();
        };
    }, [src, startTime, endTime]);

    // Position adjustment to keep inside viewport
    // Assuming fixed width around 240px
    const style: React.CSSProperties = {
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -110%)', // Centered horizontally above the cursor
        zIndex: 100,
        pointerEvents: 'none'
    };

    return (
        <div style={style} className="bg-black rounded-lg shadow-xl overflow-hidden border border-gray-700 w-[120px] aspect-[9/16] relative">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-cover"
                muted
                preload="auto"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 text-center">
                Preview {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
            </div>
        </div>
    );
};

export default VideoPreviewTooltip;
