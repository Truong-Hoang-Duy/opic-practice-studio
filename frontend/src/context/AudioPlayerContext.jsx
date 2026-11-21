import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Headphones, Download, Repeat, Loader2, X, Pause, RefreshCw } from 'lucide-react';
import { libraryApi, questionApi, resolveMediaUrl, formatApiError } from '../api/client';
import {
  cachePlaylistAudio,
  getLocalPlaylistBlobUrl,
  listCachedPlaylistKeys,
  removeCachedPlaylist,
} from '../utils/playlistCache';

const POLL_MS = 3000;
const SPEED_OPTIONS = [0.8, 1.0, 1.2];

const AudioPlayerContext = createContext(null);

const generateMissingModelAnswers = async (questionIds, level) => {
  const queue = [...questionIds];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await questionApi.regenerateModel(id, { level: level || 'IM' });
      } catch (err) {
        console.error('Model answer generation failed', err);
      }
    }
  };
  await Promise.all([worker(), worker()]);
};

export const AudioPlayerProvider = ({ enabled = true, children }) => {
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [cachedKeys, setCachedKeys] = useState({});
  const [player, setPlayer] = useState(null);
  const [loop, setLoop] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [shadowingPause, setShadowingPause] = useState(false);

  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const savedListPollRef = useRef(null);
  const activeBlobUrlRef = useRef(null);
  const lastListenArgsRef = useRef(null);

  const revokeActiveBlobUrl = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  };

  const cacheInBackground = (playlistKey, mediaUrl) => {
    if (!playlistKey || !mediaUrl) return;
    cachePlaylistAudio(playlistKey, mediaUrl).then((ok) => {
      if (ok) {
        setCachedKeys((prev) => (prev[playlistKey] ? prev : { ...prev, [playlistKey]: true }));
      }
    });
  };

  const refreshPlaylists = async () => {
    if (!enabled) return;
    try {
      const [res, localMap] = await Promise.all([
        libraryApi.listPlaylists(),
        listCachedPlaylistKeys(),
      ]);
      setSavedPlaylists(res.data || []);
      setCachedKeys(localMap);
    } catch (err) {
      console.warn('Failed to load saved playlists', err);
    }
  };

  useEffect(() => {
    if (enabled) {
      refreshPlaylists();
    } else {
      clearTimeout(pollRef.current);
      clearTimeout(savedListPollRef.current);
      revokeActiveBlobUrl();
      setPlayer(null);
      setSavedPlaylists([]);
    }
    return () => {
      clearTimeout(pollRef.current);
      clearTimeout(savedListPollRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      clearTimeout(pollRef.current);
      clearTimeout(savedListPollRef.current);
      revokeActiveBlobUrl();
    };
  }, []);

  // Poll saved playlists list only when another background build exists that the sticky player isn't already polling
  useEffect(() => {
    if (!enabled) return;
    const otherBuilding = savedPlaylists.some(
      (p) => p.status === 'building' && !(player?.status === 'building' && player?.playlistId === p.id)
    );
    if (!otherBuilding) return;
    savedListPollRef.current = setTimeout(() => {
      refreshPlaylists();
    }, POLL_MS);
    return () => clearTimeout(savedListPollRef.current);
  }, [enabled, savedPlaylists, player?.status, player?.playlistId]);

  useEffect(() => {
    if (player?.status !== 'ready' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: player.title || `Bài nghe ${player.count} câu`,
        artist: 'Eva · OPIc Practice Studio',
        album: 'OPIc Audio Studio',
      });
    } catch {}
  }, [player?.status, player?.url, player?.title]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loop;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [loop, playbackRate, player?.url]);

  const stopAndClosePlayer = () => {
    clearTimeout(pollRef.current);
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    revokeActiveBlobUrl();
    setPlayer(null);
  };

  const pausePlayer = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
  };

  const pollPlaylist = async (
    body,
    count,
    title,
    transientErrors = 0,
    isFirstPoll = true,
    knownPlaylistId = null
  ) => {
    try {
      const res =
        !isFirstPoll && knownPlaylistId
          ? await libraryApi.playlistStatus(knownPlaylistId)
          : await libraryApi.playlist(body);
      const data = res.data;
      const {
        ready,
        status,
        url,
        done,
        total,
        phase,
        error: buildError,
        playlist_id,
        id: statusRowId,
        key: returnedKey,
        playlist_key: rowKey,
        title: savedTitle,
      } = data;
      const activeId = playlist_id || statusRowId || knownPlaylistId || null;
      const activeKey = returnedKey || rowKey || null;
      const finalTitle = savedTitle || title || `Bài nghe ${count} câu`;

      if (isFirstPoll) {
        refreshPlaylists();
      } else if (activeId) {
        setSavedPlaylists((prev) =>
          prev.map((p) =>
            p.id === activeId
              ? { ...p, status: ready ? 'ready' : status, done, total, phase, error_message: buildError || null }
              : p
          )
        );
      }

      if (ready && url) {
        const resolved = resolveMediaUrl(url);
        revokeActiveBlobUrl();
        setPlayer({
          status: 'ready',
          url: resolved,
          done: total,
          total,
          count,
          title: finalTitle,
          playlistId: activeId,
          playlistKey: activeKey,
          isOffline: false,
        });
        if (activeKey) cacheInBackground(activeKey, resolved);
        refreshPlaylists();
        return;
      }

      if (status === 'error') {
        setPlayer({
          status: 'error',
          count,
          title: finalTitle,
          playlistId: activeId,
          playlistKey: activeKey,
          message: buildError || 'Không tạo được file nghe. Vui lòng thử lại.',
          retryBody: { ...body, force_retry: true },
        });
        refreshPlaylists();
        return;
      }

      setPlayer({
        status: 'building',
        done,
        total,
        phase,
        count,
        title: finalTitle,
        playlistId: activeId,
        playlistKey: activeKey,
      });
      const nextBody = body.force_retry ? { ...body, force_retry: false } : body;
      pollRef.current = setTimeout(
        () => pollPlaylist(nextBody, count, finalTitle, 0, false, activeId),
        POLL_MS
      );
    } catch (err) {
      const httpStatus = err.response?.status;
      const isTransient = !err.response || httpStatus === 429 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
      if (isTransient && transientErrors < 4) {
        pollRef.current = setTimeout(
          () => pollPlaylist(body, count, title, transientErrors + 1, isFirstPoll, knownPlaylistId),
          POLL_MS + transientErrors * 1500
        );
        return;
      }
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail?.message || formatApiError(err, 'Không tạo được file nghe.');
      setPlayer({
        status: 'error',
        count,
        title: title || `Bài nghe ${count} câu`,
        playlistId: knownPlaylistId,
        message: msg,
        retryBody: { ...body, force_retry: true },
      });
      refreshPlaylists();
    }
  };

  const startListening = async ({
    session,
    questionsToPlay,
    title = '',
    pauseOverride = null,
    includeQuestion = true,
    forceRetry = false,
    onModelsPrepared = null,
  }) => {
    const usePause = pauseOverride !== null ? pauseOverride : shadowingPause;
    const targetLevel = session?.default_model_level || 'IM';
    const listenable = (questionsToPlay || []).filter((q) => q.question_type !== 'self_intro');
    if (!listenable.length) return;
    clearTimeout(pollRef.current);

    const readyQs = listenable.filter((q) =>
      (q.model_answers || []).some((m) => m.level === targetLevel)
    );
    const ids = (readyQs.length ? readyQs : listenable).map((q) => q.id);
    const baseTitle =
      title.trim() ||
      (session?.is_study_pack
        ? `Kho ôn tập · ${ids.length} câu · ${targetLevel}`
        : `Đề #${session?.set_number ?? session?.session_number ?? session?.session_id ?? ''} · ${ids.length} câu`);
    const fullTitle =
      usePause && !baseTitle.toLowerCase().includes('nhại') ? `${baseTitle} · Nhại` : baseTitle;

    lastListenArgsRef.current = { session, questionsToPlay, baseTitle, includeQuestion };
    setPlayer({ status: 'preparing', done: 0, total: ids.length, count: ids.length, title: fullTitle });

    if (!readyQs.length) {
      await generateMissingModelAnswers(ids, targetLevel);
      if (onModelsPrepared) await onModelsPrepared();
    }
    pollPlaylist(
      {
        question_ids: ids,
        include_question: includeQuestion,
        level: targetLevel,
        shadowing_pause: usePause,
        title: fullTitle,
        session_id: session?.session_id || session?.id || undefined,
        save: true,
        force_retry: !!forceRetry,
      },
      ids.length,
      fullTitle
    );
  };

  const playSavedPlaylist = async (pl) => {
    clearTimeout(pollRef.current);
    lastListenArgsRef.current = null;

    const localHit = await getLocalPlaylistBlobUrl(pl.playlist_key);
    if (localHit?.blobUrl) {
      revokeActiveBlobUrl();
      activeBlobUrlRef.current = localHit.blobUrl;
      setPlayer({
        status: 'ready',
        url: localHit.blobUrl,
        done: pl.segment_count || pl.question_count,
        total: pl.segment_count || pl.question_count,
        count: pl.question_count,
        title: pl.title,
        playlistId: pl.id,
        playlistKey: pl.playlist_key,
        isOffline: true,
      });
      return;
    }

    if (pl.status === 'ready' && pl.file_available && pl.audio_path) {
      const resolved = resolveMediaUrl(pl.audio_path);
      revokeActiveBlobUrl();
      setPlayer({
        status: 'ready',
        url: resolved,
        done: pl.segment_count || pl.question_count,
        total: pl.segment_count || pl.question_count,
        count: pl.question_count,
        title: pl.title,
        playlistId: pl.id,
        playlistKey: pl.playlist_key,
        isOffline: false,
      });
      cacheInBackground(pl.playlist_key, resolved);
      return;
    }

    rebuildSavedPlaylist(pl);
  };

  const rebuildSavedPlaylist = async (pl) => {
    clearTimeout(pollRef.current);
    lastListenArgsRef.current = null;
    setPlayer({
      status: 'building',
      done: 0,
      total: pl.segment_count || pl.question_count || 1,
      count: pl.question_count,
      title: pl.title,
      playlistId: pl.id,
      playlistKey: pl.playlist_key,
    });
    try {
      const res = await libraryApi.rebuildPlaylist(pl.id);
      const { ready, status, url, done, total, phase, key: rebuiltKey, error: buildError } = res.data;
      const activeKey = rebuiltKey || pl.playlist_key;
      await refreshPlaylists();
      if (ready && url) {
        const resolved = resolveMediaUrl(url);
        revokeActiveBlobUrl();
        setPlayer({
          status: 'ready',
          url: resolved,
          done: total,
          total,
          count: pl.question_count,
          title: pl.title,
          playlistId: pl.id,
          playlistKey: activeKey,
          isOffline: false,
        });
        cacheInBackground(activeKey, resolved);
        return;
      }
      if (status === 'error') {
        setPlayer({
          status: 'error',
          count: pl.question_count,
          title: pl.title,
          playlistId: pl.id,
          playlistKey: activeKey,
          message: buildError || 'Không tạo lại được file nghe.',
        });
        return;
      }
      setPlayer({
        status: 'building',
        done,
        total,
        phase,
        count: pl.question_count,
        title: pl.title,
        playlistId: pl.id,
        playlistKey: activeKey,
      });
      const body = {
        question_ids: pl.question_ids,
        level: pl.level,
        include_question: pl.include_question,
        shadowing_pause: pl.shadowing_pause,
        title: pl.title,
        session_id: pl.session_id || undefined,
        save: true,
        force_retry: false,
      };
      pollRef.current = setTimeout(
        () => pollPlaylist(body, pl.question_count, pl.title, 0, false, pl.id),
        POLL_MS
      );
    } catch (err) {
      setPlayer({
        status: 'error',
        count: pl.question_count,
        title: pl.title,
        playlistId: pl.id,
        playlistKey: pl.playlist_key,
        message: formatApiError(err, 'Không tạo lại được bài nghe.'),
      });
    }
  };

  const renameSavedPlaylist = async (playlistId, title) => {
    const clean = (title || '').trim();
    if (!clean) return;
    const { data } = await libraryApi.renamePlaylist(playlistId, clean);
    setSavedPlaylists((prev) => prev.map((p) => (p.id === playlistId ? data : p)));
    if (player?.playlistId === playlistId) {
      setPlayer((p) => (p ? { ...p, title: data.title } : p));
    }
    return data;
  };

  const deleteSavedPlaylist = async (pl) => {
    await libraryApi.deletePlaylist(pl.id);
    await removeCachedPlaylist(pl.playlist_key);
    setCachedKeys((prev) => {
      if (!prev[pl.playlist_key]) return prev;
      const next = { ...prev };
      delete next[pl.playlist_key];
      return next;
    });
    setSavedPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    if (player?.playlistId === pl.id) {
      stopAndClosePlayer();
    }
  };

  const value = {
    savedPlaylists,
    cachedKeys,
    player,
    loop,
    setLoop,
    playbackRate,
    setPlaybackRate,
    shadowingPause,
    setShadowingPause,
    audioRef,
    lastListenArgsRef,
    refreshPlaylists,
    startListening,
    playSavedPlaylist,
    rebuildSavedPlaylist,
    renameSavedPlaylist,
    deleteSavedPlaylist,
    pollPlaylist,
    stopAndClosePlayer,
    pausePlayer,
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};

export const useAudioPlayer = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  return ctx;
};

/**
 * Floating Dark-Ink Global Audio Studio Bar.
 * Stays alive across every tab (Trang chủ, Kho ôn tập, Thi thử, Tiến độ) so audio never cuts off.
 */
export const GlobalAudioPlayerBar = ({ hidden = false, sidebarCollapsed = false, onOpenListeningTab }) => {
  const {
    player,
    cachedKeys,
    savedPlaylists,
    loop,
    setLoop,
    playbackRate,
    setPlaybackRate,
    shadowingPause,
    setShadowingPause,
    audioRef,
    lastListenArgsRef,
    startListening,
    rebuildSavedPlaylist,
    pollPlaylist,
    stopAndClosePlayer,
  } = useAudioPlayer();

  if (hidden || !player) return null;

  const isLocalCached = player.isOffline || (player.playlistKey && cachedKeys[player.playlistKey]);
  const pct =
    player.status === 'building' && player.total > 0
      ? Math.min(100, Math.round((player.done / player.total) * 100))
      : 0;

  return (
    <div
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-4 lg:right-0 z-40 px-3 sm:px-6 lg:px-8 pointer-events-none transition-[left] duration-200 ${
        sidebarCollapsed ? 'lg:left-11' : 'lg:left-60'
      }`}
    >
      <div className="max-w-4xl mx-auto studio-surface rounded-2xl px-4 py-3 shadow-2xl shadow-indigo-950/40 ring-1 ring-white/10 pointer-events-auto flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpenListeningTab && onOpenListeningTab()}
            className="min-w-0 text-left flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                {player.title || `Bài nghe ${player.count} câu`}
              </span>
              {isLocalCached && player.status === 'ready' && (
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-semibold shrink-0">
                  Lưu trên máy
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {player.status === 'ready' && (
              <button
                type="button"
                onClick={() => {
                  const idx = SPEED_OPTIONS.indexOf(playbackRate);
                  setPlaybackRate(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/15 text-slate-100 cursor-pointer"
              >
                {playbackRate}x
              </button>
            )}
            {lastListenArgsRef.current && (
              <button
                type="button"
                onClick={() => {
                  const next = !shadowingPause;
                  setShadowingPause(next);
                  const prev = lastListenArgsRef.current;
                  startListening({
                    session: prev.session,
                    questionsToPlay: prev.questionsToPlay,
                    title: prev.baseTitle,
                    pauseOverride: next,
                    includeQuestion: prev.includeQuestion,
                  });
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                  shadowingPause
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                    : 'bg-white/5 text-slate-300 border border-white/10'
                }`}
              >
                <Pause className="w-3 h-3" />
                <span>Nhại</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLoop((v) => !v)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                loop
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'bg-white/5 text-slate-300 border border-white/10'
              }`}
            >
              <Repeat className="w-3 h-3" />
              <span>Lặp</span>
            </button>
            {player.status === 'ready' && (
              <a
                href={player.url}
                download={`opic-audio-${player.count || 'playlist'}.mp3`}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/15 text-slate-100 inline-flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">MP3</span>
              </a>
            )}
            <button
              type="button"
              onClick={stopAndClosePlayer}
              aria-label="Đóng trình phát"
              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(player.status === 'preparing' || player.status === 'building') && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                {player.status === 'preparing'
                  ? 'Đang chuẩn bị bài mẫu...'
                  : player.phase === 'queued'
                    ? 'Đang chờ lượt tạo âm thanh...'
                    : player.phase === 'stitching'
                      ? 'Đang ghép file MP3...'
                      : `Đang tạo giọng đọc ${player.done}/${player.total} đoạn...`}
              </span>
              {player.status === 'building' && player.total > 0 && (
                <span className="font-bold text-sky-300">{pct}%</span>
              )}
            </div>
            {player.status === 'building' && player.total > 0 && (
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        )}

        {player.status === 'error' && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-rose-300 flex-1">{player.message}</p>
            {(player.retryBody || player.playlistId) && (
              <button
                type="button"
                onClick={() => {
                  if (player.retryBody) {
                    pollPlaylist(player.retryBody, player.count, player.title, 0, true);
                  } else if (player.playlistId) {
                    const found = savedPlaylists.find((p) => p.id === player.playlistId);
                    if (found) rebuildSavedPlaylist(found);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        )}

        {player.status === 'ready' && (
          <audio
            ref={audioRef}
            src={player.url}
            controls
            autoPlay
            loop={loop}
            preload="auto"
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = playbackRate;
            }}
            className="w-full h-9 rounded-lg"
          />
        )}
      </div>
    </div>
  );
};
