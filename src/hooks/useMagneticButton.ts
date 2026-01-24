import { useRef, useCallback } from 'react';

interface MagneticOptions {
  strength?: number;
  radius?: number;
}

export function useMagneticButton<T extends HTMLElement = HTMLButtonElement>(
  options: MagneticOptions = {}
) {
  const { strength = 0.3, radius = 100 } = options;
  const ref = useRef<T>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<T>) => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

    if (distance < radius) {
      const moveX = distanceX * strength;
      const moveY = distanceY * strength;
      element.style.transform = `translate(${moveX}px, ${moveY}px)`;
      element.style.transition = 'transform 0.2s ease-out';
    }
  }, [strength, radius]);

  const handleMouseLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    element.style.transform = 'translate(0, 0)';
    element.style.transition = 'transform 0.4s ease-out';
  }, []);

  return {
    ref,
    magneticProps: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
