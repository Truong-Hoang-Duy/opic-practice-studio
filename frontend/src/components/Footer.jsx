import React from 'react';
import { ShieldAlert, Globe } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-950/90 py-3 px-4 sm:px-6 lg:px-8 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        
        {/* Concise 1-line disclaimer */}
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] sm:text-xs">
            Independent educational practice tool • Not affiliated with or endorsed by ACTFL or LTI.
          </p>
        </div>

        {/* Right status */}
        <div className="flex items-center gap-4 text-slate-500 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Eva Online</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>Bilingual Studio</span>
          </div>
          <span>© 2026 OPIc Studio</span>
        </div>

      </div>
    </footer>
  );
};
