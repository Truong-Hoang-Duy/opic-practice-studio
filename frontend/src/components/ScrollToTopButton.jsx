import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const scrollPageToTop = (behavior = 'smooth') => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior });
  }
  if (typeof document !== 'undefined') {
    const mainEl = document.querySelector('main');
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({ top: 0, behavior });
    }
  }
};

export const ScrollToTopButton = ({ hasBottomNav = true }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      const mainEl = document.querySelector('main');
      const mainY = mainEl ? mainEl.scrollTop : 0;
      setVisible(Math.max(winY, mainY) > 260);
    };

    checkScroll();
    // Capture phase catches scroll on both window and inner scrollable containers (<main> in TestSession/AnswerCoaching)
    window.addEventListener('scroll', checkScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', checkScroll, { capture: true });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => scrollPageToTop('smooth')}
      title="Lên đầu trang"
      aria-label="Lên đầu trang"
      className={`fixed right-4 sm:right-6 z-40 flex items-center gap-1.5 px-3 py-2.5 sm:p-3 rounded-full bg-brand-600/95 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 border border-white/20 backdrop-blur-md transition-all transform active:scale-95 cursor-pointer ${
        hasBottomNav
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6'
          : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:bottom-6'
      }`}
    >
      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
      <span className="text-xs font-bold sm:hidden">Lên đầu</span>
    </button>
  );
};

