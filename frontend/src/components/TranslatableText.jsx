import React, { useState, useRef } from 'react';
import { Languages, BookOpen, X, Loader2, BookmarkPlus, Check, Sparkles } from 'lucide-react';
import { vocabularyApi, formatApiError } from '../api/client';
import { SpeakButton } from './SpeakButton';

// Shared in-memory cache so repeated lookups of the same word/sentence are instant
const translationCache = new Map();

const cacheKey = (mode, text, context) =>
  `${mode}|${(text || '').trim().toLowerCase()}|${(context || '').trim().toLowerCase()}`;

const cleanWordToken = (token) => token.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');

export const TranslatableText = ({
  text,
  className = '',
  topic = 'general',
  sourceQuestionId = null,
  showControls = true,
  controlsAlign = 'end', // 'start' | 'end'
}) => {
  const [lookupMode, setLookupMode] = useState(false);
  const [showSentenceTr, setShowSentenceTr] = useState(false);
  const [sentenceTr, setSentenceTr] = useState(null);
  const [loadingSentence, setLoadingSentence] = useState(false);
  const [sentenceError, setSentenceError] = useState('');

  // Active word/phrase lookup sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [wordResult, setWordResult] = useState(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [wordError, setWordError] = useState('');
  const [savedFlag, setSavedFlag] = useState(false);
  const [savingVocab, setSavingVocab] = useState(false);

  // Web/desktop text-selection floating pill
  const [selectionPhrase, setSelectionPhrase] = useState('');
  const containerRef = useRef(null);

  const rawText = (text || '').trim();
  if (!rawText) return null;

  // Tokenize into words & separators so mobile users can tap any single word cleanly
  const tokens = rawText.split(/(\s+)/);
  const wordEntries = tokens.map((tok, idx) => ({
    tok,
    idx,
    clean: cleanWordToken(tok),
  }));

  const getWordAt = (idx) => wordEntries[idx]?.clean || '';

  const buildAdjacentPhrases = (idx) => {
    if (idx === null || idx === undefined) return [];
    const cur = getWordAt(idx);
    if (!cur) return [];
    const prev = idx - 2 >= 0 ? getWordAt(idx - 2) : '';
    const next = idx + 2 < wordEntries.length ? getWordAt(idx + 2) : '';
    const next2 = idx + 4 < wordEntries.length ? getWordAt(idx + 4) : '';
    const list = [];
    if (next) list.push(`${cur} ${next}`);
    if (prev) list.push(`${prev} ${cur}`);
    if (next && next2) list.push(`${cur} ${next} ${next2}`);
    return list.filter((p) => p.toLowerCase() !== selectedText.toLowerCase());
  };

  const runTranslate = async (target, mode, context = '') => {
    const key = cacheKey(mode, target, context);
    if (translationCache.has(key)) {
      return translationCache.get(key);
    }
    const res = await vocabularyApi.translate({
      text: target,
      context_sentence: context || undefined,
      mode,
    });
    translationCache.set(key, res.data);
    return res.data;
  };

  const handleToggleSentence = async () => {
    if (showSentenceTr) {
      setShowSentenceTr(false);
      return;
    }
    setShowSentenceTr(true);
    if (sentenceTr) return;
    setLoadingSentence(true);
    setSentenceError('');
    try {
      const data = await runTranslate(rawText, 'sentence', '');
      setSentenceTr(data.translation_vi);
    } catch (err) {
      setSentenceError(formatApiError(err, 'Không dịch được câu này.'));
    } finally {
      setLoadingSentence(false);
    }
  };

  const openWordLookup = async (phrase, idx = null) => {
    const clean = (phrase || '').trim();
    if (!clean) return;
    setSelectedText(clean);
    if (idx !== null) setSelectedIndex(idx);
    setSheetOpen(true);
    setSavedFlag(false);
    setWordError('');

    const key = cacheKey('word', clean, rawText);
    if (translationCache.has(key)) {
      setWordResult(translationCache.get(key));
      setLoadingWord(false);
      return;
    }

    setWordResult(null);
    setLoadingWord(true);
    try {
      const data = await runTranslate(clean, 'word', rawText);
      setWordResult(data);
    } catch (err) {
      setWordError(formatApiError(err, 'Không tra được từ này.'));
    } finally {
      setLoadingWord(false);
    }
  };

  const handleMouseUp = () => {
    if (lookupMode || typeof window === 'undefined') return;
    const sel = window.getSelection()?.toString().trim() || '';
    const wordCount = sel.split(/\s+/).filter(Boolean).length;
    if (sel && sel.length >= 2 && sel.length <= 120 && wordCount <= 8 && /[a-zA-Z]/.test(sel)) {
      setSelectionPhrase(sel);
    } else {
      setSelectionPhrase('');
    }
  };

  const handleSaveVocab = async () => {
    if (!selectedText || savingVocab || savedFlag) return;
    setSavingVocab(true);
    try {
      const noteParts = [];
      if (wordResult?.ipa) noteParts.push(wordResult.ipa);
      if (wordResult?.translation_vi) noteParts.push(wordResult.translation_vi);
      if (wordResult?.context_note_vi) noteParts.push(wordResult.context_note_vi);

      await vocabularyApi.save({
        upgraded_phrase: selectedText,
        kind: selectedText.includes(' ') ? 'collocation' : 'vocabulary',
        topic: topic || 'general',
        example_sentence: rawText.slice(0, 950),
        note_vi: noteParts.join(' — ').slice(0, 950) || undefined,
        source_question_id: sourceQuestionId || undefined,
      });
      setSavedFlag(true);
    } catch (err) {
      alert(formatApiError(err, 'Không lưu được vào sổ tay.'));
    } finally {
      setSavingVocab(false);
    }
  };

  const adjacentPhrases = buildAdjacentPhrases(selectedIndex);

  return (
    <div ref={containerRef} className="flex flex-col gap-2" onMouseUp={handleMouseUp}>
      {/* English text (tap-to-lookup tokens when lookupMode is ON, normal selectable text otherwise) */}
      <div className={className}>
        {lookupMode ? (
          <span className="leading-relaxed">
            {wordEntries.map(({ tok, idx, clean }) => {
              if (!clean) return <span key={idx}>{tok}</span>;
              const isSelected =
                sheetOpen && selectedIndex === idx && selectedText.toLowerCase() === clean.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWordLookup(clean, idx);
                  }}
                  className={`inline px-0.5 mx-[1px] rounded transition-colors cursor-pointer border-b border-dashed ${
                    isSelected
                      ? 'bg-brand-500 text-white border-brand-400'
                      : 'border-brand-400/70 hover:bg-brand-500/15 active:bg-brand-500/25'
                  }`}
                >
                  {tok}
                </button>
              );
            })}
          </span>
        ) : (
          <span>{rawText}</span>
        )}
      </div>

      {/* Desktop/Web text selection quick translate pill */}
      {selectionPhrase && !lookupMode && (
        <div className="flex items-center gap-2 animate-in fade-in">
          <button
            type="button"
            onClick={() => {
              const phrase = selectionPhrase;
              setSelectionPhrase('');
              openWordLookup(phrase, null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Dịch cụm: "{selectionPhrase.length > 28 ? `${selectionPhrase.slice(0, 28)}…` : selectionPhrase}"</span>
          </button>
        </div>
      )}

      {/* Compact controls: Sentence Translate + Tap-to-Lookup */}
      {showControls && (
        <div className={`flex flex-wrap items-center gap-2 ${controlsAlign === 'end' ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSentence();
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              showSentenceTr
                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/50'
                : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{showSentenceTr ? 'Ẩn dịch' : 'Dịch câu'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLookupMode((v) => !v);
              setSelectionPhrase('');
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              lookupMode
                ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{lookupMode ? 'Đang bật Tra từ' : 'Tra từ'}</span>
          </button>
        </div>
      )}

      {/* Full Sentence / Paragraph Vietnamese Translation */}
      {showSentenceTr && (
        <div className="rounded-xl bg-sky-50/90 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed animate-in fade-in">
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

      {/* Mobile-first Bottom Sheet / Desktop Floating Lookup Card */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 sm:bg-transparent sm:pointer-events-none flex items-end sm:items-end sm:justify-end"
          onClick={() => setSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full sm:w-[400px] sm:m-6 bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-5 flex flex-col gap-3 animate-in slide-in-from-bottom-4"
          >
            {/* Mobile drag indicator */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white break-words">
                    {selectedText}
                  </h4>
                  {wordResult?.part_of_speech && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                      {wordResult.part_of_speech}
                    </span>
                  )}
                </div>
                {wordResult?.ipa && (
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{wordResult.ipa}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Đóng tra từ"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Expand to adjacent collocation / phrasal verb without text selection on mobile */}
            {adjacentPhrases.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Tra cả cụm:</span>
                {adjacentPhrases.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => openWordLookup(phrase, selectedIndex)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-500/15 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            )}

            {/* Meaning & context */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[64px] flex flex-col justify-center gap-1.5">
              {loadingWord ? (
                <div className="flex items-center gap-2 text-xs text-brand-600 dark:text-brand-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tra nghĩa theo ngữ cảnh...</span>
                </div>
              ) : wordError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">{wordError}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {wordResult?.translation_vi || '—'}
                  </p>
                  {wordResult?.context_note_vi && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{wordResult.context_note_vi}</span>
                    </p>
                  )}
                  {wordResult?.other_meanings_vi && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Nghĩa khác: {wordResult.other_meanings_vi}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Thumb-friendly action buttons */}
            <div className="flex items-center gap-2">
              <SpeakButton
                text={selectedText}
                id={`lookup-${selectedText}`}
                label="Nghe phát âm"
                playingLabel="Đang phát"
                className="flex-1 justify-center py-2.5"
              />
              <button
                type="button"
                onClick={handleSaveVocab}
                disabled={savingVocab || savedFlag || loadingWord}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-60 ${
                  savedFlag
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-brand-500 hover:bg-brand-600 text-white border-brand-500'
                }`}
              >
                {savedFlag ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                <span>{savedFlag ? 'Đã lưu sổ tay' : savingVocab ? 'Đang lưu...' : 'Lưu vào sổ tay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
