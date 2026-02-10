import React, { useEffect, useRef, useId } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface WarpGridBackgroundProps {
    intensity?: number;
    speed?: number;
    className?: string;
    gridColor?: string;
}

const WarpGridBackground: React.FC<WarpGridBackgroundProps> = ({
    intensity = 0.6,
    speed = 0.6,
    className = "",
    gridColor = "rgba(59, 130, 246, 0.15)"
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
    const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
    const requestRef = useRef<number>();
    const timeRef = useRef<number>(0);

    // Generate unique IDs for SVG filters to avoid conflicts
    const uniqueId = useId().replace(/:/g, '');
    const filterId = `warpFilter-${uniqueId}`;
    const patternId = `gridPattern-${uniqueId}`;

    // Mouse state: target (actual mouse pos), current (smoothed pos)
    // Normalized 0..1
    const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });

    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        if (prefersReducedMotion) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            // Normalize to 0-1
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            mouseRef.current.targetX = x;
            mouseRef.current.targetY = y;
        };

        window.addEventListener('mousemove', handleMouseMove);

        const animate = () => {
            // Update time
            timeRef.current += 0.005 * speed;

            // Smooth mouse
            const lerp = 0.05;
            mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * lerp;
            mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * lerp;

            if (turbulenceRef.current && displacementRef.current) {
                // Animate baseFrequency for liquid effect
                const freqX = 0.002 + Math.sin(timeRef.current) * 0.001;
                const freqY = 0.002 + Math.cos(timeRef.current) * 0.001;

                turbulenceRef.current.setAttribute('baseFrequency', `${freqX} ${freqY}`);

                // Influence displacement scale by mouse position (swirl effect)
                const scaleBase = 50 * intensity;
                const mouseInfluence = (Math.abs(mouseRef.current.x - 0.5) + Math.abs(mouseRef.current.y - 0.5)) * 100 * intensity;
                const currentScale = scaleBase + mouseInfluence;

                displacementRef.current.setAttribute('scale', currentScale.toString());

                // Drift background slightly based on time and mouse
                // This creates a feeling of "floating" in 3D space
                const driftX = Math.sin(timeRef.current * 0.5) * 20 + (mouseRef.current.x - 0.5) * 30;
                const driftY = Math.cos(timeRef.current * 0.3) * 20 + (mouseRef.current.y - 0.5) * 30;

                const pattern = document.getElementById(patternId);
                if (pattern) {
                    pattern.setAttribute('patternTransform', `translate(${driftX}, ${driftY})`);
                }
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [intensity, speed, prefersReducedMotion]);

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
            aria-hidden="true"
            role="presentation"
        >
            <svg
                className="w-full h-full opacity-30"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                style={{ filter: prefersReducedMotion ? 'none' : `url(#${filterId})` }}
            >
                <defs>
                    <filter id={filterId}>
                        <feTurbulence
                            ref={turbulenceRef}
                            type="fractalNoise"
                            baseFrequency="0.002 0.002"
                            numOctaves="2"
                            result="noise"
                        />
                        <feDisplacementMap
                            ref={displacementRef}
                            in="SourceGraphic"
                            in2="noise"
                            scale="50"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>

                    <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke={gridColor} strokeWidth="1" />
                    </pattern>
                </defs>

                <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </svg>

            {/* Vignette for depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_90%)]"></div>
        </div>
    );
};

export default WarpGridBackground;
