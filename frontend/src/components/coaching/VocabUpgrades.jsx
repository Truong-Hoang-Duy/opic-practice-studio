import React, { useEffect, useState } from 'react';
import { TrendingUp, ArrowRight, Volume2, Star, Loader2 } from 'lucide-react';
import { vocabularyApi } from '../../api/client';
import { speakPhrase } from '../../utils/speakPhrase';

export const KIND_LABELS = {
  collocation: 'Collocation',
  phrasal_verb: 'Phrasal verb',
  idiom: 'Idiom',
  topic_word: 'Từ chủ đề',
};

export const KIND_STYLES = {
  collocation: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
  phrasal_verb: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30',
  idiom: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  topic_word: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
};

// Highlights the upgraded phrase inside its example sentence (case-insensitive, first match)
export const HighlightedExample = ({ sentence, phrase }) => {
  if (!sentence) return null;
  const idx = phrase ? sentence.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (idx < 0) return <>"{sentence}"</>;
  return (
    <>
      "{sentence.slice(0, idx)}
      <mark className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 rounded px-0.5">{sentence.slice(idx, idx + phrase.length)}</mark>
      {sentence.slice(idx + phrase.length)}"
    </>
  );
};

// IH/AL vocabulary upgrades for one answer, each savable to the personal notebook
export const VocabUpgrades = ({ upgrades = [], questionId }) => {
  const [savedIds, setSavedIds] = useState({}); // upgraded phrase (lowercase) -> notebook id
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (!upgrades.length) return;
    vocabularyApi.list()
      .then(({ data }) => setSavedIds(Object.fromEntries(data.map(v => [v.upgraded_phrase.toLowerCase(), v.id]))))
      .catch(err => console.warn('Could not load the vocabulary notebook', err));
  }, [upgrades.length]);

  if (!upgrades.length) return null;

  const toggleSave = async (u) => {
    const key = u.upgraded_phrase.toLowerCase();
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      if (savedIds[key]) {
        await vocabularyApi.remove(savedIds[key]);
        setSavedIds(prev => { const next = { ...prev }; delete next[key]; return next; });
      } else {
        const { data } = await vocabularyApi.save({ ...u, source_question_id: questionId || null });
        setSavedIds(prev => ({ ...prev, [key]: data.id }));
      }
    } catch (err) {
      console.error('Vocabulary notebook update failed', err);
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <span>Từ vựng nâng band IH/AL</span>
        <span className="normal-case font-medium text-slate-500 dark:text-slate-400">· Bấm ☆ để lưu vào Sổ tay</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {upgrades.map((u) => {
          const key = u.upgraded_phrase.toLowerCase();
          const saved = !!savedIds[key];
          return (
            <div key={key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 line-through">{u.original_phrase}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{u.upgraded_phrase}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => speakPhrase(u.upgraded_phrase)}
                    title="Nghe phát âm"
                    aria-label={`Nghe phát âm ${u.upgraded_phrase}`}
                    className="p-2 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleSave(u)}
                    disabled={busy[key]}
                    title={saved ? 'Bỏ khỏi Sổ tay' : 'Lưu vào Sổ tay từ vựng'}
                    aria-pressed={saved}
                    className={`p-2 rounded-lg cursor-pointer disabled:opacity-50 ${saved
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:bg-slate-200/70 dark:hover:bg-slate-800'}`}
                  >
                    {busy[key] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />}
                  </button>
                </div>
              </div>
              <span className={`self-start text-[10px] font-semibold px-1.5 py-0.5 rounded border ${KIND_STYLES[u.kind] || KIND_STYLES.collocation}`}>
                {KIND_LABELS[u.kind] || u.kind}
              </span>
              {u.example_sentence && (
                <p className="italic text-slate-700 dark:text-slate-300 leading-relaxed">
                  <HighlightedExample sentence={u.example_sentence} phrase={u.upgraded_phrase} />
                </p>
              )}
              {u.note_vi && <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">🇻🇳 {u.note_vi}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
