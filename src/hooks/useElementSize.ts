import { useState, useLayoutEffect, MutableRefObject } from 'react';

interface Size {
    width: number;
    height: number;
}

export function useElementSize<T extends HTMLElement = HTMLDivElement>(
    ref: MutableRefObject<T | null>
): Size {
    const [size, setSize] = useState<Size>({
        width: 0,
        height: 0,
    });

    useLayoutEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!Array.isArray(entries) || !entries.length) return;
            const entry = entries[0];

            // Use borderBoxSize if available for better accuracy including borders/padding
            // Fallback to contentRect
            let width, height;
            if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
                width = entry.borderBoxSize[0].inlineSize;
                height = entry.borderBoxSize[0].blockSize;
            } else {
                width = entry.contentRect.width;
                height = entry.contentRect.height;
            }

            setSize({ width, height });
        });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [ref]);

    return size;
}

// A4 Constants in Pixels (96 DPI)
export const A4_HEIGHT_PX = 1123;
// Padding p-12 is 3rem = 48px
export const PAGE_PADDING_Y_PX = 96; // 48px top + 48px bottom
export const CONTENT_HEIGHT_PX = A4_HEIGHT_PX - PAGE_PADDING_Y_PX;
