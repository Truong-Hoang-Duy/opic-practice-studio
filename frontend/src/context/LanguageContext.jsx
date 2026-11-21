import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'opic_ui_lang';

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') return saved;
    } catch {}
    return 'vi';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (next === 'vi' || next === 'en') setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  }, []);

  const isVi = lang === 'vi';
  const isEn = lang === 'en';

  // Concise bilingual selector: pick(vietnameseText, englishText)
  const pick = useCallback((vi, en) => (lang === 'en' ? en : vi), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, isVi, isEn, pick }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'vi',
      setLang: () => {},
      toggleLang: () => {},
      isVi: true,
      isEn: false,
      pick: (vi) => vi,
    };
  }
  return ctx;
};
