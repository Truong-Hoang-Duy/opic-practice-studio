import React, { useEffect, useMemo, useState } from 'react';
import { BookMarked, Volume2, CheckCircle2, RotateCcw, Trash2, Search, Loader2, Sparkles } from 'lucide-react';
import { vocabularyApi } from '../api/client';
import { speakPhrase } from '../utils/speakPhrase';
import { KIND_LABELS, KIND_STYLES, HighlightedExample } from '../components/coaching/VocabUpgrades';

const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'learning', label: 'Đang học' },
  { key: 'mastered', label: 'Đã thành thạo' },
];

export const VocabularyNotebook = ({ onGoPractice }) => {
  const [items, setItems] = useState([]);
  const [topicLabels, setTopicLabels] = useState({});
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const chip = (active) => `px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
    active
      ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
  }`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5">
      {/* Header + counters */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-brand-500" />
            Sổ tay từ vựng OPIc
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Các cụm từ nâng band IH/AL bạn đã lưu từ phần chấm điểm sau mỗi câu trả lời.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
          {[
            { label: 'Tổng số', value: items.length, cls: 'text-slate-900 dark:text-white' },
            { label: 'Đang học', value: items.length - masteredCount, cls: 'text-amber-600 dark:text-amber-400' },
            { label: 'Thành thạo', value: masteredCount, cls: 'text-emerald-600 dark:text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80">
              <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm cụm từ, từ gốc hoặc câu ví dụ..."
              className="w-full theme-input rounded-xl pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStatus(f.key)} className={chip(status === f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
        {topicCounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTopic('all')} className={chip(topic === 'all')}>Mọi chủ đề ({items.length})</button>
            {topicCounts.map(([key, count]) => (
              <button key={key} onClick={() => setTopic(key)} className={chip(topic === key)}>
                {topicLabels[key] || key} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải sổ tay...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 sm:p-12 border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-center flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sổ tay của bạn còn trống</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            Sau mỗi câu trả lời được chấm, mục <strong>"Từ vựng nâng band IH/AL"</strong> sẽ gợi ý các cụm từ thay thế cho từ cơ bản bạn đã dùng.
            Bấm ☆ để lưu chúng vào đây.
          </p>
          {onGoPractice && (
            <button onClick={onGoPractice} className="mt-1 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold cursor-pointer">
              Luyện tập ngay
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">Không có cụm từ nào khớp bộ lọc.</p>
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
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">thay cho <span className="line-through">{item.original_phrase}</span></p>
                    )}
                  </div>
                  <button
                    onClick={() => speakPhrase(item.upgraded_phrase)}
                    title="Nghe phát âm"
                    aria-label={`Nghe phát âm ${item.upgraded_phrase}`}
                    className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${KIND_STYLES[item.kind] || KIND_STYLES.collocation}`}>
                    {KIND_LABELS[item.kind] || item.kind}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                    {topicLabels[item.topic] || item.topic}
                  </span>
                  {mastered && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">
                      ✓ Đã thành thạo
                    </span>
                  )}
                </div>

                {item.example_sentence && (
                  <button
                    onClick={() => speakPhrase(item.example_sentence)}
                    title="Nghe câu ví dụ"
                    className="text-left italic text-slate-700 dark:text-slate-300 leading-relaxed hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <HighlightedExample sentence={item.example_sentence} phrase={item.upgraded_phrase} />
                  </button>
                )}
                {item.note_vi && <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">🇻🇳 {item.note_vi}</p>}

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
                    {mastered ? 'Học lại' : 'Đánh dấu thành thạo'}
                  </button>
                  {confirmDelete === item.id ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => remove(item)} disabled={busy[item.id]} className="px-2.5 py-1.5 rounded-lg font-semibold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer disabled:opacity-50">Xoá</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-1.5 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Huỷ</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(item.id)}
                      title="Xoá khỏi sổ tay"
                      aria-label={`Xoá ${item.upgraded_phrase}`}
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
  );
};
