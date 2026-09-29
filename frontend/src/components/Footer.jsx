import React from 'react';
import { ShieldAlert, Globe } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-950/90 py-8 px-4 sm:px-6 lg:px-8 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        
        {/* Left disclaimer */}
        <div className="flex items-start gap-2.5 max-w-2xl">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Disclaimer: </span>
            OPIc Practice Studio is an independent educational practice platform and is <span className="font-medium text-slate-800 dark:text-slate-300">NOT affiliated with, sponsored by, or endorsed by ACTFL or Language Testing International (LTI)</span>. 
            All simulated test materials, question combinations, and rubric adaptations are original educational exercises crafted to help Vietnamese candidates achieve Intermediate High (IH) proficiency.
          </p>
        </div>

        {/* Right copyright & status */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>AI Examiner Eva Online</span>
          </div>
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            <span>EN / VI Bilingual Studio</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
