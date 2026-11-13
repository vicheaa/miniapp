import { useEffect, useLayoutEffect } from 'react';
import { attachKeyboardViewport } from '../utils/keyboardViewport';

/** One controller for the app, including keyboard recovery across route changes. */
export function useKeyboardViewport() {
  useEffect(() => attachKeyboardViewport(), []);
}

/** Keep native focus panning out of the document; the screen's content scrolls. */
export function useKeyboardPage() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.keyboardPage = 'true';
    const page = document.querySelector<HTMLElement>('.keyboard-page');
    const footer = page?.querySelector<HTMLElement>(':scope > .cart-footer');
    let footerHeight = 0;
    const measureFooter = () => {
      if (!page || !footer) return;
      const height = Math.ceil(footer.getBoundingClientRect().height);
      if (height > 0 && height !== footerHeight) {
        footerHeight = height;
        page.style.setProperty('--keyboard-footer-height', `${height}px`);
      }
    };
    measureFooter();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureFooter);
    if (footer) observer?.observe(footer);
    window.addEventListener('resize', measureFooter);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measureFooter);
      page?.style.removeProperty('--keyboard-footer-height');
      delete root.dataset.keyboardPage;
    };
  }, []);
}
