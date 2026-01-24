import { useCallback, useEffect } from 'react';

export function useSmoothScroll() {
  useEffect(() => {
    // Add smooth scroll behavior to html element
    document.documentElement.style.scrollBehavior = 'smooth';

    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const scrollTo = useCallback((elementId: string, offset: number = 80) => {
    const element = document.getElementById(elementId);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top,
        behavior: 'smooth',
      });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  return { scrollTo, scrollToTop };
}

// Component for smooth scroll links
export function SmoothScrollLink({
  href,
  children,
  className,
  offset = 80,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  offset?: number;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top,
        behavior: 'smooth',
      });
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
