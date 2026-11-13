// Prononciation des noms chinois du bestiaire : un mp3 par nom dans audio/noms/ (voir tools/gen-name-audio.py).
// Le fichier n'est téléchargé qu'au clic (ni précache ni cache du service worker) et seulement en ligne.
export const nameAudioId = hanzi => [...hanzi].map(c => c.codePointAt(0).toString(16)).join('-');
export const canPlayNameAudio = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let current = null;
export function playNameAudio(hanzi, base = 'audio/noms/') {
    if (!hanzi || !canPlayNameAudio()) return;
    try {
        if (current) current.pause();
        current = new Audio(`${base}${nameAudioId(hanzi)}.mp3`);
        current.play().catch(() => {});
    } catch { /* lecture impossible : on ignore */ }
}
