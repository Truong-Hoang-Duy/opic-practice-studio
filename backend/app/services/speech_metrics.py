"""
Speech flow & hesitation analysis computed from the STT word timings (no AI call):
speaking rate (WPM), awkward pauses (>= 2 s of dead air between words) and filler words.
Words come from Soniox / the mock STT as {word (or text), confidence, start_ms, end_ms}.
"""
import re
from typing import Any, Dict, List, Optional

PAUSE_THRESHOLD_SEC = 2.0

# ACTFL IH speaking-rate bands for Vietnamese learners
WPM_SLOW_BELOW = 90
WPM_IDEAL_MAX = 130
WPM_FAST_ABOVE = 150

PACE_LABELS_VI = {
    "too_slow": "Quá chậm / Ngập ngừng nhiều (Cần tăng tốc để đạt IH)",
    "ideal": "Tốc độ lý tưởng chuẩn ACTFL IH",
    "slightly_fast": "Hơi nhanh nhưng vẫn ổn (Chú ý phát âm rõ âm đuôi)",
    "too_fast": "Nói quá nhanh (Dễ nuốt âm đuôi và mất kiểm soát thì)",
}

# Pure hesitation sounds, incl. stretched spellings ("ummm", "uhh", "erm", "hmm")
_HESITATION_RE = re.compile(r"^(u+m+|u+h+m*|e+r+m*|e+r+|a+h+|h+m+)$")
# Discourse fillers that are also real words: counted only when used as a filler (see _is_filler_like)
_SOFT_FILLERS = {"actually", "basically"}
_PHRASE_FILLERS = [("you", "know"), ("i", "mean")]
# "do you know ...?" / "if I mean it" are real questions/verbs, not fillers
_YOU_KNOW_BLOCKERS = {"do", "did", "does", "don't", "didn't", "doesn't", "if"}


def _norm(token: str) -> str:
    return re.sub(r"[^\w']", "", (token or "").lower())


def _canonical_hesitation(word: str) -> str:
    if word.startswith("u") and "h" in word:
        return "uhm" if word.endswith("m") else "uh"
    if word.startswith("u"):
        return "um"
    if word.startswith("e"):
        return "er"
    if word.startswith("a"):
        return "ah"
    return word


def _text(w: Dict[str, Any]) -> str:
    return str(w.get("word") if w.get("word") is not None else w.get("text") or "")


def _is_filler_like(raw: List[str], norm: List[str], i: int) -> bool:
    """'like' is only a filler when set off by commas or right after a hesitation ("it was, like, huge")."""
    has_comma_after = raw[i].rstrip().endswith(",")
    prev_comma = i > 0 and raw[i - 1].rstrip().endswith(",")
    prev_hesitation = i > 0 and bool(_HESITATION_RE.match(norm[i - 1]))
    return has_comma_after or prev_comma or prev_hesitation


def find_fillers(words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    raw = [_text(w) for w in words]
    norm = [_norm(t) for t in raw]
    found: List[Dict[str, Any]] = []
    i = 0
    while i < len(norm):
        word = norm[i]
        nxt = norm[i + 1] if i + 1 < len(norm) else None
        prev = norm[i - 1] if i > 0 else None
        filler = None
        span = 1
        if (word, nxt) in _PHRASE_FILLERS and not (word == "you" and prev in _YOU_KNOW_BLOCKERS):
            filler, span = f"{word} {nxt}", 2
        elif _HESITATION_RE.match(word):
            filler = _canonical_hesitation(word)
        elif word in _SOFT_FILLERS:
            filler = word
        elif word == "like" and _is_filler_like(raw, norm, i):
            filler = "like"
        if filler:
            start_ms = words[i].get("start_ms")
            found.append({
                "filler": filler,
                "word_index": i,
                "time_sec": round(start_ms / 1000, 1) if isinstance(start_ms, (int, float)) else None,
            })
        i += span
    return found


def pace_band(wpm: float) -> str:
    if wpm < WPM_SLOW_BELOW:
        return "too_slow"
    if wpm <= WPM_IDEAL_MAX:
        return "ideal"
    if wpm <= WPM_FAST_ABOVE:
        return "slightly_fast"
    return "too_fast"


def _has_timing(words: List[Dict[str, Any]]) -> bool:
    return any(isinstance(w.get("end_ms"), (int, float)) and w.get("end_ms") > 0 for w in words)


def compute_speech_metrics(words: Optional[List[Dict[str, Any]]], duration_seconds: Optional[float] = None) -> Optional[Dict[str, Any]]:
    """Returns None when nothing was said (no words to analyse)."""
    words = [w for w in (words or []) if _norm(_text(w))]
    if not words:
        return None

    timed = _has_timing(words)
    speaking_time = 0.0
    if timed:
        speaking_time = (words[-1].get("end_ms", 0) - words[0].get("start_ms", 0)) / 1000
    if speaking_time < 1.0:
        # No usable word timings: fall back to the recording length
        speaking_time = float(duration_seconds or 0)
    wpm = round(len(words) / speaking_time * 60) if speaking_time >= 1.0 else None

    pauses: List[Dict[str, Any]] = []
    if timed:
        for prev, cur in zip(words, words[1:]):
            gap = (cur.get("start_ms", 0) - prev.get("end_ms", 0)) / 1000
            if gap >= PAUSE_THRESHOLD_SEC:
                pauses.append({
                    "start_sec": round(prev.get("end_ms", 0) / 1000, 1),
                    "end_sec": round(cur.get("start_ms", 0) / 1000, 1),
                    "duration_sec": round(gap, 1),
                    "after_word": _text(prev),
                    "before_word": _text(cur),
                })

    fillers = find_fillers(words)
    counts: Dict[str, int] = {}
    for f in fillers:
        counts[f["filler"]] = counts.get(f["filler"], 0) + 1

    band = pace_band(wpm) if wpm is not None else None
    minutes = speaking_time / 60 if speaking_time else 0
    return {
        "total_words": len(words),
        "speaking_time_sec": round(speaking_time, 1),
        "wpm": wpm,
        "pace": band,
        "pace_label_vi": PACE_LABELS_VI.get(band) if band else None,
        "start_delay_sec": round(words[0].get("start_ms", 0) / 1000, 1) if timed else None,
        "pauses": pauses,
        "pause_count": len(pauses),
        "longest_pause_sec": max((p["duration_sec"] for p in pauses), default=0.0),
        "total_pause_sec": round(sum(p["duration_sec"] for p in pauses), 1),
        "fillers": {
            "total": len(fillers),
            "counts": dict(sorted(counts.items(), key=lambda kv: -kv[1])),
            "occurrences": fillers,
        },
        "fillers_per_min": round(len(fillers) / minutes, 1) if minutes else None,
        "has_timing": timed,
    }
