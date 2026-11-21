/**
 * Persistent browser-side audio cache (Cache Storage API) for saved MP3 playlists.
 * Survives Render Free ephemeral disk wipes (15-min idle spin-down / redeploys) and enables
 * instant offline replay on phones & desktops without re-synthesizing or using DB storage.
 */

const CACHE_NAME = 'opic-saved-playlists-v1';
const CACHE_URL_PREFIX = 'https://opic-local-cache.internal/playlist/';
const MAX_CACHED_PLAYLISTS = 15;

export const isPlaylistCacheSupported = () =>
  typeof window !== 'undefined' && 'caches' in window && typeof window.caches?.open === 'function';

const keyToCacheUrl = (playlistKey) => `${CACHE_URL_PREFIX}${encodeURIComponent(playlistKey)}.mp3`;

const cacheUrlToKey = (url) => {
  if (!url || !url.startsWith(CACHE_URL_PREFIX)) return null;
  const tail = url.slice(CACHE_URL_PREFIX.length);
  return decodeURIComponent(tail.replace(/\.mp3$/, ''));
};

export const listCachedPlaylistKeys = async () => {
  if (!isPlaylistCacheSupported()) return {};
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const reqs = await cache.keys();
    const map = {};
    for (const req of reqs) {
      const k = cacheUrlToKey(req.url);
      if (k) map[k] = true;
    }
    return map;
  } catch {
    return {};
  }
};

export const cachePlaylistAudio = async (playlistKey, mediaUrl) => {
  if (!playlistKey || !mediaUrl || !isPlaylistCacheSupported()) return false;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const cacheKey = keyToCacheUrl(playlistKey);
    const existing = await cache.match(cacheKey);
    if (existing) return true;

    const resp = await fetch(mediaUrl, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(mediaUrl));
    if (!resp || !resp.ok) return false;
    const blob = await resp.blob();
    if (!blob || blob.size === 0) return false;

    const headers = new Headers({
      'Content-Type': blob.type || 'audio/mpeg',
      'Content-Length': String(blob.size),
      'X-Cached-At': String(Date.now()),
    });
    await cache.put(cacheKey, new Response(blob, { status: 200, headers }));

    // Keep local browser storage bounded (LRU eviction beyond MAX_CACHED_PLAYLISTS)
    const keys = await cache.keys();
    if (keys.length > MAX_CACHED_PLAYLISTS) {
      const dated = await Promise.all(
        keys.map(async (req) => {
          const matched = await cache.match(req);
          const ts = Number(matched?.headers?.get('X-Cached-At') || 0);
          return { req, ts };
        })
      );
      dated.sort((a, b) => a.ts - b.ts);
      const excess = dated.length - MAX_CACHED_PLAYLISTS;
      for (let i = 0; i < excess; i++) {
        if (dated[i].req.url !== cacheKey) {
          await cache.delete(dated[i].req);
        }
      }
    }
    return true;
  } catch {
    // QuotaExceededError or opaque response — degrade gracefully to server streaming
    return false;
  }
};

export const getLocalPlaylistBlobUrl = async (playlistKey) => {
  if (!playlistKey || !isPlaylistCacheSupported()) return null;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    const match = await cache.match(keyToCacheUrl(playlistKey));
    if (!match) return null;
    const blob = await match.blob();
    if (!blob || blob.size === 0) return null;
    return { blobUrl: URL.createObjectURL(blob), size: blob.size };
  } catch {
    return null;
  }
};

export const removeCachedPlaylist = async (playlistKey) => {
  if (!playlistKey || !isPlaylistCacheSupported()) return;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    await cache.delete(keyToCacheUrl(playlistKey));
  } catch {
    // ignore
  }
};
