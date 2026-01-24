import React, { useEffect, useState } from 'react';

export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 z-[100] pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      <div
        className="h-full transition-all duration-100 ease-out"
        style={{
          width: `${progress}%`,
          background: 'var(--premium-gradient)',
          boxShadow: '0 0 10px var(--premium-accent), 0 0 20px rgba(0,212,255,0.5)',
        }}
      />
    </div>
  );
}
