import { useEffect, useState } from 'react';

interface ParallaxOptions {
  speed?: number;
  maxOffset?: number;
}

export function useParallax(options: ParallaxOptions = {}) {
  const { speed = 0.5, maxOffset = 200 } = options;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newOffset = Math.min(scrollY * speed, maxOffset);
      setOffset(newOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, maxOffset]);

  return {
    offset,
    style: {
      transform: `translateY(${offset}px)`,
    },
  };
}

export function useParallaxMultiple(count: number, baseSpeed: number = 0.1) {
  const [offsets, setOffsets] = useState<number[]>(new Array(count).fill(0));

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const newOffsets = offsets.map((_, i) => scrollY * (baseSpeed * (i + 1)));
      setOffsets(newOffsets);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [count, baseSpeed]);

  return offsets;
}
