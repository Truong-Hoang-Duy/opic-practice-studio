import React, { useState, useEffect } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { vocabularyApi, formatApiError } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

// Shared in-memory cache & bounded background prefetch queue so clicking "Dịch câu" is instant
const translationCache = new Map();
const inflightTranslations = new Map();
const prefetchQueue = [];
let activePrefetches = 0;
const MAX_CONCURRENT_PREFETCH = 2;

const fetchSentenceTranslation = (text) => {
  const clean = (text || '').trim();
  if (!clean) return Promise.resolve('');
  if (translationCache.has(clean)) return Promise.resolve(translationCache.get(clean));
  if (inflightTranslations.has(clean)) return inflightTranslations.get(clean);

  const req = vocabularyApi
    .translate({ text: clean, mode: 'sentence' })
    .then(({ data }) => {
      const vi = (data?.translation_vi || '').trim();
      if (vi) translationCache.set(clean, vi);
      return vi;
    })
    .finally(() => {
      inflightTranslations.delete(clean);
    });

  inflightTranslations.set(clean, req);
  return req;
};

const drainPrefetchQueue = () => {
  while (activePrefetches < MAX_CONCURRENT_PREFETCH && prefetchQueue.length > 0) {
    const text = prefetchQueue.shift();
    activePrefetches += 1;
    fetchSentenceTranslation(text)
      .catch(() => {})
      .finally(() => {
        activePrefetches -= 1;
        drainPrefetchQueue();
      });
  }
};

const prefetchSentence = (text) => {
  const clean = (text || '').trim();
  if (!clean || clean.length > 1500) return;
  if (translationCache.has(clean) || inflightTranslations.has(clean) || prefetchQueue.includes(clean)) return;
  prefetchQueue.push(clean);
  drainPrefetchQueue();
};

export const TranslatableText = ({
  text,
  preTranslatedVi = null,
  className = '',
  showControls = true,
  controlsAlign = 'end', // 'start' | 'end'
  externalShowTranslation = null, // boolean when controlled by a single parent "Dịch" toggle
}) => {
  const { isVi } = useLanguage();
  const rawText = (text || '').trim();
  const initialVi = (preTranslatedVi || '').trim() || translationCache.get(rawText) || null;
  const [showSentenceTr, setShowSentenceTr] = useState(false);
  const [sentenceTr, setSentenceTr] = useState(initialVi);
  const [loadingSentence, setLoadingSentence] = useState(false);
  const [sentenceError, setSentenceError] = useState('');

  const effectiveShowControls = showControls && isVi;
  const isVisible = isVi && (externalShowTranslation !== null ? !!externalShowTranslation : showSentenceTr);

  useEffect(() => {
    if (!rawText) return;
    const pre = (preTranslatedVi || '').trim();
    if (pre) {
      translationCache.set(rawText, pre);
      setSentenceTr(pre);
      return;
    }
    const cached = translationCache.get(rawText) || null;
    setSentenceTr(cached);
    if (effectiveShowControls) {
      prefetchSentence(rawText);
    }
  }, [rawText, preTranslatedVi, effectiveShowControls]);

  useEffect(() => {
    if (externalShowTranslation !== true || !rawText) return;
    if ((preTranslatedVi || '').trim()) {
      setSentenceTr((preTranslatedVi || '').trim());
      return;
    }
    if (translationCache.has(rawText)) {
      setSentenceTr(translationCache.get(rawText));
      return;
    }
    let cancelled = false;
    setLoadingSentence(true);
    setSentenceError('');
    fetchSentenceTranslation(rawText)
      .then((vi) => {
        if (!cancelled) setSentenceTr(vi);
      })
      .catch((err) => {
        if (!cancelled) setSentenceError(formatApiError(err, 'Không dịch được câu này.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingSentence(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalShowTranslation, rawText, preTranslatedVi]);

  if (!rawText) return null;

  const handleToggleSentence = async (e) => {
    e.stopPropagation();
    if (showSentenceTr) {
      setShowSentenceTr(false);
      return;
    }
    setShowSentenceTr(true);
    if (translationCache.has(rawText)) {
      setSentenceTr(translationCache.get(rawText));
      return;
    }
    setLoadingSentence(true);
    setSentenceError('');
    try {
      const vi = await fetchSentenceTranslation(rawText);
      setSentenceTr(vi);
    } catch (err) {
      setSentenceError(formatApiError(err, 'Không dịch được câu này.'));
    } finally {
      setLoadingSentence(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={className}>
        <span>{rawText}</span>
      </div>

      {effectiveShowControls && (
        <div className={`flex flex-wrap items-center gap-2 ${controlsAlign === 'end' ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={handleToggleSentence}
            className={`h-7 inline-flex items-center justify-center px-2.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${
              showSentenceTr
                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/50'
                : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
            }`}
          >
            <span className="inline-grid items-center justify-items-center">
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${!showSentenceTr ? 'visible' : 'invisible pointer-events-none'}`}>
                <Languages className="w-3.5 h-3.5 shrink-0" />
                <span>Dịch câu</span>
              </span>
              <span className={`col-start-1 row-start-1 inline-flex items-center gap-1 whitespace-nowrap ${showSentenceTr ? 'visible' : 'invisible pointer-events-none'}`}>
                <Languages className="w-3.5 h-3.5 shrink-0" />
                <span>Ẩn dịch</span>
              </span>
            </span>
          </button>
        </div>
      )}

      {isVisible && (
        <div className="rounded-xl bg-sky-50/90 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/30 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 leading-snug animate-in fade-in">
          {loadingSentence ? (
            <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang dịch sang tiếng Việt...
            </span>
          ) : sentenceError ? (
            <span className="text-rose-600 dark:text-rose-400">{sentenceError}</span>
          ) : (
            <span>{sentenceTr}</span>
          )}
        </div>
      )}
    </div>
  );
};
