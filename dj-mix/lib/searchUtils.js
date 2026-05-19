export function buildResultHTML(track, kind = 'song', index = 0) {
  const artUrl = getBestArtworkUrl(track);
  const artist = track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu');
  const hasDuration = Number(track.duration_ms) > 0;
  const dur = hasDuration ? formatTime(track.duration_ms) : '--:--';
  const isArtistResult = Boolean(track.isArtistResult);
  const localBadge = track.isLocalResult ? '<span class="result-local-badge" title="Fichier local">📁</span>' : '';
  const stemsBadge = (!isArtistResult && hasAvailableStems(track))
    ? '<span class="result-stem-badge" title="Stems disponibles">🧩</span>'
    : '';
  const durationHtml = isArtistResult ? '<span class="result-duration">Artiste</span>' : `<span class="result-duration">${dur}</span>`;
  const addLabel = isArtistResult ? '🔎' : '+';
  const addAria = isArtistResult ? 'Rechercher cet artiste' : 'Ajouter';
  const playNowBtn = !isArtistResult
    ? '<button class="play-now-btn" type="button" aria-label="Lire de suite (fade)">Fade</button>'
    : '';
  const deleteBtn = (!isArtistResult && track.isLocalResult)
    ? `<button class="delete-btn" aria-label="Supprimer" data-track-name="${escHtml(track.name)}" data-artist-name="${escHtml(artist)}" data-cache-path="${escHtml(track.cachePath || '')}">🗑</button>`
    : '';

  return `
    <div class="search-result-item" data-kind="${kind}" data-index="${index}" role="button" tabindex="0">
      <img class="result-art" src="${escHtml(artUrl)}" alt="" loading="lazy">
      <div class="result-info">
        <div class="result-name">${escHtml(track.name)} ${localBadge}${stemsBadge}</div>
        <div class="result-artist">${escHtml(artist)}</div>
      </div>
      ${durationHtml}
      ${playNowBtn}
      ${deleteBtn}
      <button class="add-btn" type="button" aria-label="${addAria}">${addLabel}</button>
    </div>`;
}

export function buildSearchResultsSectionsHTML(songResults, artistResults) {
  const songs = Array.isArray(songResults) ? songResults : [];
  const artists = Array.isArray(artistResults) ? artistResults : [];
  const sections = [];

  if (songs.length) {
    sections.push(`
      <div class="search-section" data-section="songs">
        <div class="search-empty" style="text-align:left; padding-bottom:6px;">Musiques (${songs.length})</div>
        ${songs.map((track, index) => buildResultHTML(track, 'song', index)).join('')}
      </div>
    `);
  }

  if (artists.length) {
    sections.push(`
      <div class="search-section" data-section="artists">
        <div class="search-empty" style="text-align:left; padding-bottom:6px;">Artistes (${artists.length})</div>
        ${artists.map((track, index) => buildResultHTML(track, 'artist', index)).join('')}
      </div>
    `);
  }

  return sections.join('');
}

export function normalizeApiSearchResponse(data) {
  if (!data) return [];
  const rootCandidates = [];

  if (Array.isArray(data)) rootCandidates.push(...data);
  if (Array.isArray(data.results)) rootCandidates.push(...data.results);
  if (Array.isArray(data.items)) rootCandidates.push(...data.items);
  if (Array.isArray(data?.artists?.results)) rootCandidates.push(...data.artists.results);
  if (Array.isArray(data?.tracks?.results)) rootCandidates.push(...data.tracks.results);
  if (Array.isArray(data.tracks)) rootCandidates.push(...data.tracks);
  if (Array.isArray(data.songs)) rootCandidates.push(...data.songs);
  if (Array.isArray(data.artists)) rootCandidates.push(...data.artists);
  if (Array.isArray(data.media)) rootCandidates.push(...data.media);
  if (Array.isArray(data?.tracks?.items)) rootCandidates.push(...data.tracks.items);
  if (Array.isArray(data?.items?.tracks)) rootCandidates.push(...data.items.tracks);
  if (Array.isArray(data?.data)) rootCandidates.push(...data.data);

  if (!rootCandidates.length) {
    rootCandidates.push(data);
  }

  return rootCandidates.flatMap((item) => extractSongCandidatesFromApiItem(item));
}

export function extractSongCandidatesFromApiItem(item) {
  if (!item) return [];
  if (Array.isArray(item)) return item.flatMap((entry) => extractSongCandidatesFromApiItem(entry));
  if (typeof item !== 'object') return [];

  const type = String(item.type || item.resultType || item.kind || '').toLowerCase();
  const nestedSongCollections = [
    item.results,
    item?.artists?.results,
    item?.tracks?.results,
    item.tracks,
    item.songs,
    item.topTracks,
    item.popularTracks,
    item.items,
    item.data,
    item?.items?.tracks,
    item?.album?.tracks,
  ];

  const nestedSongs = nestedSongCollections
    .filter((collection) => Array.isArray(collection) && collection.length)
    .flatMap((collection) => extractSongCandidatesFromApiItem(collection));

  if (nestedSongs.length) return nestedSongs;

  if (type.includes('artist') || type.includes('artiste')) {
    return [];
  }

  const hasTrackShape = Boolean(
    item.title
    || item.trackName
    || item.song
    || (item.name && (item.duration || item.duration_ms || item.uri || item.downloadUrl))
  );

  return hasTrackShape ? [item] : [];
}

export function cleanItunesSearchText(text) {
  return String(text || '')
    .replace(/\s*[\[(][^\])\n]*[\])\n]/g, '')
    .replace(/\s*[-–|]\s*(Official|Audio|Lyrics?|Video|HD|HQ|4K|Live|Karaoke|Cover|Clip).*/i, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.+$/i, '')
    .trim();
}

export function splitItunesSearchQuery(rawQuery) {
  const cleaned = cleanItunesSearchText(rawQuery);
  const separators = [' - ', ' – ', ' — ', ' | ', ': '];
  for (const separator of separators) {
    const parts = cleaned.split(separator);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(separator).trim(),
      };
    }
  }

  return { artist: '', title: cleaned };
}

export function mapApiTrackToSearchItem(track) {
  if (!track) return null;
  const isLocalResult = isLocalTrackResult(track);
  const stems = extractStemSourceUrls(track);

  const type = String(track.type || track.resultType || track.kind || '').toLowerCase();
  const isArtistResult = Boolean(
    type.includes('artist')
    || type.includes('artiste')
    || (!track.trackName && !track.title && !track.song && !track.previewUrl && !track.downloadUrl && track.name)
  );

  if (isArtistResult) {
    const artistName = track.name || track.artistName || track.artist || 'Artiste inconnu';
    const artUrl = getBestArtworkUrl(track);
    return {
      id: track.id || track.artistId || `artist:${artistName}`,
      uri: track.viewUrl || track.artistViewUrl || `api:artist:${track.id || artistName}`,
      name: artistName,
      artist: artistName,
      artUrl,
      duration_ms: 0,
      duration: 0,
      isArtistResult: true,
      isLocalResult,
      popularityScore: getPopularityScore(track),
      artists: [{ name: artistName }],
      album: { images: artUrl ? [{ url: artUrl }] : [] },
      downloadUrl: '',
    };
  }

  const title = track.title || track.trackName || track.name || track.song || track.grandparentTitle;
  if (!title) return null;

  const artist = track.artist || track.artistName || track.originalTitle || track.grandparentTitle || track.collectionName || 'Artiste inconnu';
  const artUrl = getBestArtworkUrl(track);
  const duration = getTrackDurationMs(track);
  const audioFeatures = extractAudioFeatures(track);
  const bpm = extractTrackBpm({ ...track, audioFeatures });
  const genre = extractTrackGenre(track);

  return {
    id: track.id || track.ratingKey || `${title}-${artist}`,
    uri: track.uri || track.downloadUrl || `api:track:${track.id || title}`,
    name: title,
    artist,
    artUrl,
    duration_ms: duration,
    duration,
    bpm,
    genre,
    loudnessDb: extractTrackLoudnessDb(track),
    audioFeatures,
    isArtistResult: false,
    isLocalResult,
    cachePath: track.cachePath || track.filePath || track.path || '',
    stemsStatus: track.stemsStatus || '',
    popularityScore: getPopularityScore(track),
    artists: [{ name: artist }],
    album: { images: artUrl ? [{ url: artUrl }, { url: artUrl }] : [] },
    downloadUrl: track.downloadUrl || track.streamUrl || track.url || '',
    vocalsUrl: stems.vocalsUrl,
    instrumentalUrl: stems.instrumentalUrl,
    echoUrl: stems.echoUrl,
    distortionUrl: stems.distortionUrl,
  };
}

export function extractStemSourceUrls(track) {
  if (!track || typeof track !== 'object') {
    return { vocalsUrl: '', instrumentalUrl: '', echoUrl: '', distortionUrl: '' };
  }

  const isUsableStemUrl = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('blob:')) return true;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^\/(api|cache)\//i.test(trimmed)) return true;
    return false;
  };

  const pickFirst = (candidates) => {
    for (const candidate of candidates) {
      if (!isUsableStemUrl(candidate)) continue;
      return candidate.trim();
    }
    return '';
  };

  const vocalsUrl = pickFirst([
    track.vocals,
    track.vocalsUrl,
    track.vocals_url,
    track.vocalUrl,
    track.vocal_url,
    track.withVocalsUrl,
    track.voiceUrl,
    track.stems?.vocals,
    track.stems?.vocalsUrl,
    track.stems?.vocalUrl,
    track.vocalsPath,
    track.versions?.vocal?.url,
    track.versions?.vocals?.url,
  ]);

  const instrumentalUrl = pickFirst([
    track.instrumental,
    track.instrumentalUrl,
    track.instrumental_url,
    track.noVocalUrl,
    track.no_vocal_url,
    track.novocalUrl,
    track.noVocalsUrl,
    track.withoutVocalsUrl,
    track.karaokeUrl,
    track.stems?.instrumental,
    track.stems?.instrumentalUrl,
    track.stems?.noVocalUrl,
    track.instrumentalPath,
    track.versions?.novocal?.url,
    track.versions?.instrumental?.url,
    track.versions?.no_vocals?.url,
  ]);

  const echoUrl = pickFirst([
    track.echo,
    track.echoUrl,
    track.echo_url,
    track.vocalEchoUrl,
    track.stems?.echo,
    track.stems?.echoUrl,
    track.effects?.echo,
    track.versions?.echo?.url,
    track.echoPath,
  ]);

  const distortionUrl = pickFirst([
    track.distortion,
    track.distortionUrl,
    track.distortion_url,
    track.vocalDistortionUrl,
    track.stems?.distortion,
    track.stems?.distortionUrl,
    track.effects?.distortion,
    track.versions?.distortion?.url,
    track.distortionPath,
  ]);

  return { vocalsUrl, instrumentalUrl, echoUrl, distortionUrl };
}

export function hasAvailableStems(track) {
  if (!track || typeof track !== 'object') return false;
  const stems = extractStemSourceUrls(track);
  if (stems.vocalsUrl || stems.instrumentalUrl || stems.echoUrl || stems.distortionUrl) return true;
  return String(track.stemsStatus || '').toLowerCase() === 'ready';
}

export function sortSearchResultsByPopularity(a, b) {
  if (a.isLocalResult !== b.isLocalResult) {
    return a.isLocalResult ? -1 : 1;
  }

  if (a.isArtistResult !== b.isArtistResult) {
    return a.isArtistResult ? 1 : -1;
  }

  const scoreA = Number.isFinite(a.popularityScore) ? a.popularityScore : 0;
  const scoreB = Number.isFinite(b.popularityScore) ? b.popularityScore : 0;
  if (scoreA !== scoreB) return scoreB - scoreA;

  return 0;
}

export function isLocalTrackResult(track) {
  if (!track || typeof track !== 'object') return false;

  if (track.cached === true || track.isCached === true) return true;

  const candidates = [
    track.isLocal,
    track.local,
    track.sourceType,
    track.source,
    track.location,
    track.storage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      if (candidate) return true;
      continue;
    }

    const text = String(candidate || '').trim().toLowerCase();
    if (!text) continue;
    if (text === 'local' || text === 'cached' || text === 'cache' || text === 'disk' || text === 'file' || text === 'true') {
      return true;
    }
  }

  return false;
}

export function getPopularityScore(track) {
  if (!track || typeof track !== 'object') return 0;

  const candidates = [
    track.popularity,
    track.popularityScore,
    track.score,
    track.rank,
    track.rating,
    track.ratingCount,
    track.listenerCount,
    track.playCount,
    track.plays,
    track.views,
    track.followers,
    track.weight,
    track.position,
    track.index,
    track.order,
    track.sort,
    track.metrics?.popularity,
    track.stats?.popularity,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      if (candidate === track.rank || candidate === track.position || candidate === track.index || candidate === track.order || candidate === track.sort) {
        return 1_000_000 - numeric;
      }
      return numeric;
    }
  }

  return 0;
}

export function extractAudioFeatures(track) {
  if (!track || typeof track !== 'object') {
    return null;
  }
  const features = track.audioFeatures || track.audio_features || {};
  if (!Object.keys(features).length) return null;
  return {
    bpm: Number(features.bpm),
    energy: Number(features.energy),
    danceability: Number(features.danceability),
    acousticness: Number(features.acousticness),
    instrumentalness: Number(features.instrumentalness),
    liveness: Number(features.liveness),
    speechiness: Number(features.speechiness),
    valence: Number(features.valence),
    rhythm: String(features.rhythm || '').toLowerCase(),
    source: String(features.source || 'unknown'),
  };
}

export function extractTrackBpm(track) {
  if (!track || typeof track !== 'object') return null;

  const directCandidates = [
    track.bpm,
    track.tempo,
    track.beatsPerMinute,
    track.beats_per_minute,
    track.trackBpm,
    track.track_bpm,
    track.analysis?.bpm,
    track.stats?.bpm,
    track.metadata?.bpm,
    track.audioFeatures?.bpm,
    track.audio_features?.bpm,
  ];

  for (const value of directCandidates) {
    const bpm = Number(value);
    if (Number.isFinite(bpm) && bpm > 0) return bpm;
  }

  return null;
}

export function extractTrackGenre(track) {
  if (!track || typeof track !== 'object') return '';

  const collectValues = (target, value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => collectValues(target, entry));
      return;
    }

    if (value && typeof value === 'object') {
      collectValues(target, value.name);
      collectValues(target, value.label);
      collectValues(target, value.value);
      collectValues(target, value.genre);
      return;
    }

    const text = String(value || '').trim();
    if (!text) return;
    text.split(/[;,|]+/g).forEach((part) => {
      const genre = String(part || '').trim();
      if (genre) target.push(genre);
    });
  };

  const scalarCandidates = [
    track.genre,
    track.genreName,
    track.primaryGenreName,
    track.style,
    track.category,
    track.subgenre,
    track.subGenre,
    track.metadata?.genre,
    track.album?.genre,
    track.audioFeatures?.genre,
    track.audio_features?.genre,
    track.tags?.genre,
    track.audioFeatures?.rhythm ? `Rythme: ${track.audioFeatures.rhythm}` : '',
  ];

  for (const value of scalarCandidates) {
    const genre = String(value || '').trim();
    if (genre) return genre;
  }

  const values = [];
  [
    track.genres,
    track.genreNames,
    track.styles,
    track.tags,
    track.metadata?.genres,
    track.album?.genres,
    track.audioFeatures?.genres,
    track.audio_features?.genres,
  ].forEach((candidate) => collectValues(values, candidate));

  const firstGenre = values.find((value) => String(value || '').trim());
  if (firstGenre) return String(firstGenre).trim();

  return '';
}

export function extractTrackLoudnessDb(track) {
  if (!track || typeof track !== 'object') return null;

  const candidates = [
    track.loudnessDb,
    track.loudness_db,
    track.loudness,
    track.decibels,
    track.decibel,
    track.db,
    track.volumeDb,
    track.volume_db,
    track.replayGainDb,
    track.replaygain,
    track.audio?.loudnessDb,
    track.audio?.loudness,
    track.metadata?.loudnessDb,
    track.metadata?.loudness,
    track.metadata?.decibels,
    track.meta?.loudnessDb,
    track.meta?.loudness,
    track.stats?.loudness,
    track.analysis?.loudness,
  ];

  for (const candidate of candidates) {
    const db = parseDecibelValue(candidate);
    if (Number.isFinite(db)) return db;
  }

  return null;
}

export function parseDecibelValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;

  const normalized = match[0].replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getTrackDurationMs(track) {
  if (!track) return 0;

  const candidates = [
    track.duration_ms,
    track.durationMs,
    track.durationMS,
    track.trackDurationMs,
    track.track_duration_ms,
    track.lengthMs,
    track.length_ms,
    track.trackTimeMillis,
    track.timeMillis,
    track.durationMillis,
    track.durationInMs,
    track.durationInSec,
    track.durationInSeconds,
    track.lengthSeconds,
    track.seconds,
    track.duration,
    track.length,
    track.runtime,
    track.time,
    track.formattedDuration,
    track.formatted_duration,
    track.durationMilliseconds,
    track.durationInMilliseconds,
    track.lengthMilliseconds,
    track.lengthInMilliseconds,
    track.totalDuration,
    track.totalDurationMs,
    track.totalLength,
    track.playbackDuration,
    track.trackDuration,
    track.songLength,
    track.audioDuration,
    track.mediaLength,
    track.totalMilliseconds,
    track.playback_duration,
    track.trackLength,
    track.duration?.ms,
    track.duration?.milliseconds,
    track.duration?.millis,
    track.duration?.seconds,
    track.duration?.sec,
    track.duration?.formatted,
    track.duration?.text,
    track.meta?.duration,
    track.metadata?.duration,
    track.attributes?.duration,
    track.track?.duration_ms,
    track.track?.duration,
    track.track?.trackTimeMillis,
    track.track?.duration?.ms,
  ];

  for (const value of candidates) {
    const ms = parseDurationToMs(value);
    if (ms > 0) return ms;
  }

  return 0;
}

export function parseDurationToMs(value) {
  if (value && typeof value === 'object') {
    const nested = [
      value.ms,
      value.milliseconds,
      value.millis,
      value.seconds,
      value.sec,
      value.formatted,
      value.text,
      value.value,
      value.duration,
    ];

    for (const candidate of nested) {
      const ms = parseDurationToMs(candidate);
      if (ms > 0) return ms;
    }
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return 0;
    return value < 1000 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value !== 'string') return 0;
  const text = value.trim();
  if (!text) return 0;

  const isoMatch = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    const h = Number(isoMatch[1] || 0);
    const m = Number(isoMatch[2] || 0);
    const s = Number(isoMatch[3] || 0);
    const totalSeconds = (h * 3600) + (m * 60) + s;
    if (totalSeconds > 0) return totalSeconds * 1000;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
  }

  const colonParts = text.split(':').map((part) => Number(part));
  if (colonParts.length >= 2 && colonParts.every((n) => Number.isFinite(n) && n >= 0)) {
    let seconds = 0;
    for (const part of colonParts) {
      seconds = (seconds * 60) + part;
    }
    return Math.round(seconds * 1000);
  }

  const match = text.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  if (match) {
    const h = Number(match[1] || 0);
    const m = Number(match[2] || 0);
    const s = Number(match[3] || 0);
    const totalSeconds = (h * 3600) + (m * 60) + s;
    if (totalSeconds > 0) return totalSeconds * 1000;
  }

  return 0;
}

export function getBestArtworkUrl(track) {
  if (!track) return '';

  const directCandidates = [
    track.artUrl,
    track.artworkUrl100,
    track.artworkUrl60,
    track.artworkUrl,
    track.cover,
    track.coverUrl,
    track.image,
    track.imageUrl,
    track.thumbnail,
    track.thumb,
    track.poster,
    track.posterUrl,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const nestedCollections = [
    track.album?.images,
    track.images,
    track.thumbnails,
    track.artworks,
    track.covers,
  ];

  for (const collection of nestedCollections) {
    if (!Array.isArray(collection) || !collection.length) continue;

    for (const image of collection) {
      if (!image) continue;
      if (typeof image === 'string' && image.trim()) return image.trim();
      if (typeof image?.url === 'string' && image.url.trim()) return image.url.trim();
      if (typeof image?.src === 'string' && image.src.trim()) return image.src.trim();
    }
  }

  if (typeof track.album?.artwork === 'string' && track.album.artwork.trim()) return track.album.artwork.trim();
  if (typeof track.album?.cover === 'string' && track.album.cover.trim()) return track.album.cover.trim();

  return '';
}

export function formatTime(ms) {
  const total = Math.round((Number(ms) || 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
