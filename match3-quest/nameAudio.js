// Prononciation des noms chinois du bestiaire : un mp3 par nom dans audio/noms/ (voir tools/gen-name-audio.py).
// Le fichier n'est téléchargé qu'au clic (ni précache ni cache du service worker) et seulement en ligne.
export const nameAudioId = hanzi => [...hanzi].map(c => c.codePointAt(0).toString(16)).join('-');
export const canPlayNameAudio = () => typeof navigator === 'undefined' || navigator.onLine !== false;

import { duckMusic } from './music.js';

// La musique baisse pendant la prononciation (durée du mp3 une fois connue, 3 s en attendant).
export const NAME_AUDIO_DUCK = { factor: 0.2, ms: 3000 };

let current = null;
export function playNameAudio(hanzi, base = 'audio/noms/') {
    if (!hanzi || !canPlayNameAudio()) return;
    try {
        if (current) current.pause();
        current = new Audio(`${base}${nameAudioId(hanzi)}.mp3`);
        const audio = current;
        duckMusic(NAME_AUDIO_DUCK.factor, NAME_AUDIO_DUCK.ms);
        audio.addEventListener?.('loadedmetadata', () => { if (Number.isFinite(audio.duration)) duckMusic(NAME_AUDIO_DUCK.factor, audio.duration * 1000 + 300); });
        audio.play().catch(() => {});
    } catch { /* lecture impossible : on ignore */ }
}
