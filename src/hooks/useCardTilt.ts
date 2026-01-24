import { useRef, useCallback } from 'react';

interface TiltOptions {
  max?: number;
  scale?: number;
  speed?: number;
  glare?: boolean;
  glareMax?: number;
}

export function useCardTilt<T extends HTMLElement = HTMLDivElement>(options: TiltOptions = {}) {
  const { max = 10, scale = 1.02, speed = 400, glare = true, glareMax = 0.2 } = options;
  const ref = useRef<T>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<T>) => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -max;
    const rotateY = ((x - centerX) / centerX) * max;

    element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
    element.style.transition = `transform ${speed / 4}ms ease-out`;

    // Glare effect
    if (glare) {
      const glareEl = element.querySelector('.card-glare') as HTMLElement;
      if (glareEl) {
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareMax}), transparent 50%)`;
        glareEl.style.opacity = '1';
      }
    }
  }, [max, scale, speed, glare, glareMax]);

  const handleMouseLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    element.style.transition = `transform ${speed}ms ease-out`;

    if (glare) {
      const glareEl = element.querySelector('.card-glare') as HTMLElement;
      if (glareEl) {
        glareEl.style.opacity = '0';
      }
    }
  }, [speed, glare]);

  return {
    ref,
    tiltProps: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
