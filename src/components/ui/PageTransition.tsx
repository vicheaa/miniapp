import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;

    // Determine direction: going deeper = forward, going shallower = back
    const isForward = currentPath.split('/').length >= prevPath.split('/').length && currentPath !== prevPath;
    const isBack = currentPath.split('/').length < prevPath.split('/').length;

    // Remove previous animation classes
    el.classList.remove('page-enter', 'page-enter-back');

    if (isForward) {
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add('page-enter');
    } else if (isBack) {
      void el.offsetWidth;
      el.classList.add('page-enter-back');
    }

    prevPathRef.current = currentPath;

    const handleEnd = () => {
      el.classList.remove('page-enter', 'page-enter-back');
    };
    el.addEventListener('animationend', handleEnd, { once: true });

    return () => {
      el.removeEventListener('animationend', handleEnd);
    };
  }, [location.pathname]);

  return (
    <div ref={containerRef} className="w-full h-full">
      {children}
    </div>
  );
}
