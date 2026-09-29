import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const ViTooltip = ({ text, vi, children, position = "top" }) => {
  const [visible, setVisible] = useState(false);

  const posClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div 
      className="relative inline-flex items-center group cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      {children}
      {visible && vi && (
        <div className={`absolute z-50 ${posClasses[position]} w-64 p-2.5 rounded-lg bg-slate-900 border border-brand-500/40 shadow-xl shadow-black/50 text-xs text-slate-200 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95`}>
          <div className="flex items-center gap-1.5 font-semibold text-brand-400 mb-1">
            <span className="text-sm">🇻🇳</span>
            <span>Gợi ý tiếng Việt:</span>
          </div>
          <p className="leading-relaxed text-slate-300 font-normal">{vi}</p>
        </div>
      )}
    </div>
  );
};

export const HelpBadge = ({ vi }) => (
  <ViTooltip vi={vi}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-brand-400 transition-colors ml-1 inline" />
  </ViTooltip>
);
