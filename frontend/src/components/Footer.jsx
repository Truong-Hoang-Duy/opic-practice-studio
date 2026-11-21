import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const Footer = ({ desktopHidden = false }) => {
  const { pick } = useLanguage();
  if (desktopHidden) return null;
  return (
    <footer className="hidden lg:block w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#0b1120]/70 backdrop-blur-xs py-2.5 px-6 mt-auto transition-colors">
      <div className="max-w-6xl mx-auto flex flex-row items-center justify-between gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>© 2026 OPIc Practice Studio</span>
        <span className="text-slate-400 dark:text-slate-500">
          {pick(
            'Công cụ học tập độc lập · Không trực thuộc ACTFL hay LTI',
            'Independent study tool · Not affiliated with ACTFL or LTI'
          )}
        </span>
      </div>
    </footer>
  );
};
