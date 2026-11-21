const STORAGE_KEY = 'opic_study_activity_days_v1';

const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const readStudyActivityDays = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const recordStudyActivity = (date = new Date()) => {
  const key = toLocalDateKey(date);
  const existing = new Set(readStudyActivityDays());
  existing.add(key);
  const sorted = Array.from(existing).sort().slice(-120);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {}
  return sorted;
};

/**
 * Merges local study activity days (Speaking drill, Flashcards SRS, Mock test)
 * with any historical backend daily-workout streak days into a single unified streak.
 */
export const computeUnifiedStreak = (backendDays = [], sessionDates = []) => {
  const daySet = new Set(readStudyActivityDays());

  (backendDays || []).forEach((d) => {
    if (d?.done && d?.date) daySet.add(String(d.date).slice(0, 10));
  });

  (sessionDates || []).forEach((iso) => {
    if (!iso) return;
    try {
      daySet.add(toLocalDateKey(new Date(iso)));
    } catch {}
  });

  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  // Build 7-day dots ending today
  const last_7_days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - offset);
    const k = toLocalDateKey(dt);
    last_7_days.push({ date: k, done: daySet.has(k) });
  }

  // Compute current consecutive streak ending today or yesterday
  let current = 0;
  let cursor = daySet.has(todayKey) ? new Date(today) : daySet.has(yesterdayKey) ? new Date(yesterday) : null;
  while (cursor) {
    const k = toLocalDateKey(cursor);
    if (!daySet.has(k)) break;
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    current,
    activeToday: daySet.has(todayKey),
    last_7_days,
  };
};
