import React from 'react';

interface YouTubeLogoProps {
    className?: string;
    width?: number | string;
    height?: number | string;
}

export const YouTubeLogo = ({ className, width = 24, height = 24 }: YouTubeLogoProps) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 576 512"
            width={width}
            height={height}
            className={className}
            fill="currentColor"
            role="img"
            aria-label="YouTube"
        >
            {/* Official YouTube Logo Path (FontAwesome Source or similar standard path) */}
            {/* Replaced with a simple colored SVG representation if needed, but path usually takes single color. 
                Wait, user asked for "Original", which usually means RED + WHITE.
                If I use fill="currentColor", it takes text color.
                I should hardcode the colors or use multiple paths.
            */}
            <path
                fill="#FF0000"
                d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 42.15 48.284 48.47 42.591 11.486 213.371 11.486 213.371 11.486s170.78 0 213.371-11.486c23.497-6.321 42.003-24.82 48.284-48.47C565.342 345.826 565.342 256.388 565.342 256.388s0-89.438-11.412-132.305z"
            />
            <path
                fill="#FFFFFF"
                d="M232 337.741V175.035l143 81.354z"
            />
        </svg>
    );
};
