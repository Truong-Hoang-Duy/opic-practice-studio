import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, RotateCcw, Trash2, Search, Loader2, Sparkles } from 'lucide-react';
import { vocabularyApi } from '../api/client';
import { SpeakButton } from '../components/SpeakButton';
import { KIND_LABELS, KIND_STYLES, HighlightedExample } from '../components/coaching/VocabUpgrades';
import { notify } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

const DEV_SAMPLE_VOCAB = [
  {
    original_phrase: 'very busy',
    upgraded_phrase: 'hectic schedule',
    kind: 'collocation',
    topic: 'work',
    example_sentence: 'Even with my hectic schedule during the week, I try to unwind on Sundays.',
    note_vi: 'Lịch trình bận rộn — tự nhiên hơn rất nhiều so với "very busy".',
  },
  {
    original_phrase: 'relax after work',
    upgraded_phrase: 'unwind and recharge my batteries',
    kind: 'idiom',
    topic: 'leisure',
    example_sentence: 'Listening to acoustic playlists helps me unwind and recharge my batteries.',
    note_vi: 'Thư giãn và nạp lại năng lượng — cụm ăn điểm IH cực tốt cho sở thích.',
  },
  {
    original_phrase: 'very nice room',
    upgraded_phrase: 'cozy and sunlit living space',
    kind: 'collocation',
    topic: 'home',
    example_sentence: 'My favorite spot is the living room because it is a cozy and sunlit living space.',
    note_vi: 'Không gian sống ấm cúng và tràn ngập ánh sáng.',
  },
  {
    original_phrase: 'a sudden problem happened',
    upgraded_phrase: 'things took an unexpected turn',
    kind: 'idiom',
    topic: 'role_play',
    example_sentence: 'Everything was going smoothly until things took an unexpected turn right before departure.',
    note_vi: 'Câu chuyển cao trào (complication) đắt giá cho các bài kể chuyện & Role-play.',
  },
];

const STATUS_FILTERS = [
  { key: 'all', labelVi: 'Tất cả', labelEn: 'All' },
  { key: 'learning', labelVi: 'Đang học', labelEn: 'Learning' },
  { key: 'mastered', labelVi: 'Đã thành thạo', labelEn: 'Mastered' },
];

export const VocabularyNotebook = ({ onGoPractice, embedded = false }) => {
  const { isVi, pick } = useLanguage();
  const [items, setItems] = useState([]);
  const [topicLabels, setTopicLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [seedingDev, setSeedingDev] = useState(false);

  const handleSeedDevVocab = async () => {
    if (!import.meta.env.DEV || seedingDev) return;
    setSeedingDev(true);
    try {
      const saved = [];
      for (const sample of DEV_SAMPLE_VOCAB) {
        const { data } = await vocabularyApi.save(sample);
        saved.push(data);
      }
      setItems((prev) => [...saved, ...prev]);
      notify.success(`Đã nạp ${saved.length} cụm từ mẫu nâng band (DEV).`);
    } catch {
      notify.error('Không nạp được từ vựng mẫu.');
    } finally {
      setSeedingDev(false);
    }
  };

  useEffect(() => {
    Promise.all([vocabularyApi.list(), vocabularyApi.meta()])
      .then(([listRes, metaRes]) => {
        setItems(listRes.data);
        setTopicLabels(Object.fromEntries(metaRes.data.topics.map(t => [t.key, t.label])));
      })
      .catch(err => console.error('Failed to load the vocabulary notebook', err))
      .finally(() => setLoading(false));
  }, []);

  // Only topics the learner actually has words for, with counts
  const topicCounts = useMemo(() => {
    const counts = {};
    items.forEach(i => { counts[i.topic] = (counts[i.topic] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const masteredCount = items.filter(i => i.status === 'mastered').length;

  const visible = items.filter(i =>
    (topic === 'all' || i.topic === topic) &&
    (status === 'all' || i.status === status) &&
    (!query.trim() || `${i.upgraded_phrase} ${i.original_phrase || ''} ${i.example_sentence || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  );

  const setItemBusy = (id, value) => setBusy(prev => ({ ...prev, [id]: value }));

  const toggleMastered = async (item) => {
    setItemBusy(item.id, true);
    try {
      const { data } = await vocabularyApi.update(item.id, { status: item.status === 'mastered' ? 'learning' : 'mastered' });
      setItems(prev => prev.map(i => (i.id === item.id ? data : i)));
    } catch (err) {
      console.error('Failed to update phrase', err);
    } finally {
      setItemBusy(item.id, false);
    }
  };

  const remove = async (item) => {
    setItemBusy(item.id, true);
    try {
      await vocabularyApi.remove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete phrase', err);
      setItemBusy(item.id, false);
    }
  };

  const chip = (active) => `px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
    active
      ? 'bg-gradient-to-r from-indigo-600 to-sky-500 text-white border-transparent shadow-sm'
      : 'bg-white dark:bg-[#141e33] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
  }`;

  return (
    <div
      className={
        embedded
          ? 'flex flex-col gap-3 lg:flex-1 lg:min-h-0'
          : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4'
      }
    >
      {/* Header + counters */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-brand-500" />
              {pick('Từ vựng nâng band', 'Vocabulary Upgrades')}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {pick('Các cụm từ nâng band bạn đã lưu sau mỗi câu trả lời.', 'Saved higher-band expressions from your evaluated speaking answers.')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
            {[
              { label: pick('Tổng số', 'Total'), value: items.length, cls: 'text-slate-900 dark:text-white' },
              { label: pick('Đang học', 'Learning'), value: items.length - masteredCount, cls: 'text-amber-600 dark:text-amber-400' },
              { label: pick('Thành thạo', 'Mastered'), value: masteredCount, cls: 'text-emerald-600 dark:text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-xl px-3 py-2">
                <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-2xl p-3 border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pick('Tìm cụm từ, từ gốc hoặc câu ví dụ...', 'Search phrases, original words, or examples...')}
              className="w-full theme-input rounded-xl pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStatus(f.key)} className={chip(status === f.key)}>{pick(f.labelVi, f.labelEn)}</button>
            ))}
          </div>
        </div>
        {topicCounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTopic('all')} className={chip(topic === 'all')}>{pick('Mọi chủ đề', 'All Topics')}</button>
            {topicCounts.map(([key]) => (
              <button key={key} onClick={() => setTopic(key)} className={chip(topic === key)}>
                {topicLabels[key] || key}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List (Independently Scrollable inside embedded workspace) */}
      <div className={embedded ? 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1' : ''}>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> {pick('Đang tải sổ tay...', 'Loading notebook...')}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 sm:p-12 border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-center flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{pick('Sổ tay của bạn còn trống', 'Your notebook is empty')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            {isVi ? (
              <>Sau mỗi câu trả lời được chấm, mục <strong>"Từ vựng nâng band IH/AL"</strong> sẽ gợi ý các cụm từ thay thế cho từ cơ bản bạn đã dùng. Bấm ☆ để lưu chúng vào đây.</>
            ) : (
              <>After each evaluated answer, <strong>"Vocabulary Upgrades (IH/AL)"</strong> recommends stronger expressions for basic phrases you used. Click ☆ to save them here.</>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {onGoPractice && (
              <button onClick={onGoPractice} className="px-4 py-2 rounded-xl btn-brand-gradient text-xs font-extrabold cursor-pointer">
                {pick('Luyện tập ngay', 'Practice Now')}
              </button>
            )}
            {import.meta.env.DEV && (
              <button
                type="button"
                disabled={seedingDev}
                onClick={handleSeedDevVocab}
                className="px-4 py-2 rounded-xl border border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {seedingDev ? pick('Đang nạp...', 'Loading...') : pick('DEV: Nạp từ vựng mẫu', 'DEV: Seed sample vocab')}
              </button>
            )}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">{pick('Không có cụm từ nào khớp bộ lọc.', 'No phrases match this filter.')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map(item => {
            const mastered = item.status === 'mastered';
            return (
              <div
                key={item.id}
                className={`glass-card rounded-2xl p-4 border bg-white dark:bg-slate-900/80 flex flex-col gap-2.5 text-xs transition-colors ${
                  mastered ? 'border-emerald-300 dark:border-emerald-500/30' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white leading-snug break-words">{item.upgraded_phrase}</p>
                    {item.original_phrase && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{pick('thay cho', 'instead of')} <span className="line-through">{item.original_phrase}</span></p>
                    )}
                  </div>
                  <SpeakButton
                    text={item.upgraded_phrase}
                    id={`nb-word-${item.id}`}
                    label={pick('Nghe', 'Listen')}
                    playingLabel={pick('Đang phát', 'Playing')}
                    title={pick(`Nghe phát âm ${item.upgraded_phrase}`, `Listen to ${item.upgraded_phrase}`)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${KIND_STYLES[item.kind] || KIND_STYLES.collocation}`}>
                    {KIND_LABELS[item.kind] || item.kind}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                    {topicLabels[item.topic] || item.topic}
                  </span>
                  {mastered && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">
                      ✓ {pick('Đã thành thạo', 'Mastered')}
                    </span>
                  )}
                </div>

                {item.example_sentence && (
                  <div className="flex flex-col gap-1.5">
                    <p className="italic text-slate-700 dark:text-slate-300 leading-relaxed">
                      <HighlightedExample sentence={item.example_sentence} phrase={item.upgraded_phrase} />
                    </p>
                    <SpeakButton
                      variant="chip"
                      text={item.example_sentence}
                      id={`nb-ex-${item.id}`}
                      label={pick('Nghe câu ví dụ', 'Play example')}
                      title={pick('Nghe câu ví dụ', 'Play example sentence')}
                      className="self-start"
                    />
                  </div>
                )}
                {isVi && item.note_vi && <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">🇻🇳 {item.note_vi}</p>}

                <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleMastered(item)}
                    disabled={busy[item.id]}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-50 ${
                      mastered
                        ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                    }`}
                  >
                    {mastered ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {mastered ? pick('Học lại', 'Review again') : pick('Đánh dấu thành thạo', 'Mark mastered')}
                  </button>
                  {confirmDelete === item.id ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => remove(item)} disabled={busy[item.id]} className="px-2.5 py-1.5 rounded-lg font-semibold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer disabled:opacity-50">{pick('Xoá', 'Delete')}</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-1.5 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{pick('Huỷ', 'Cancel')}</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(item.id)}
                      title={pick('Xoá khỏi sổ tay', 'Remove from notebook')}
                      aria-label={pick(`Xoá ${item.upgraded_phrase}`, `Delete ${item.upgraded_phrase}`)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
