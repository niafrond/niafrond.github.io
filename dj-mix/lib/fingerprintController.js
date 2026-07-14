// fingerprintController.js — Pure request/response shaping for the AcoustID
// verification flow (`POST /api/fingerprint/check` and `/correct`). No fetch,
// no DOM: keeps the network/DOM glue in main.js unit-testable in isolation.

/**
 * @param {object} data - JSON body from `POST /api/fingerprint/check`.
 * @returns {{ matched: boolean, suggestions: Array<{trackName: string, artistName: string, score: number|null, reason: string}> }}
 */
export function parseFingerprintCheckResponse(data) {
  if (data?.matched) return { matched: true, suggestions: [] };
  const suggestions = data?.suggestedTrackName
    ? [{
        trackName: data.suggestedTrackName,
        artistName: data.suggestedArtistName || '',
        score: Number.isFinite(data?.score) ? data.score : null,
        reason: data?.reason || '',
      }]
    : [];
  return { matched: false, suggestions };
}

/**
 * @param {{trackName: string, artistName: string}} trackRef
 * @param {{trackName?: string, name?: string, title?: string, artistName?: string, artist?: string}} replacement
 * @returns {object} body for `POST /api/fingerprint/correct`
 */
export function buildFingerprintCorrectRequestBody(trackRef, replacement) {
  return {
    artistName: trackRef?.artistName || '',
    trackName: trackRef?.trackName || '',
    replacement: {
      trackName: replacement?.trackName || replacement?.name || replacement?.title || '',
      artistName: replacement?.artistName || replacement?.artist || '',
    },
  };
}

/**
 * @param {{corrected?: boolean, renamed?: boolean}} data - JSON body from `POST /api/fingerprint/correct`.
 */
export function buildFingerprintCorrectToastMessage(data) {
  if (!data?.corrected) return 'Correction non appliquée';
  return data.renamed ? 'Titre corrigé et renommé' : 'Correction enregistrée';
}
