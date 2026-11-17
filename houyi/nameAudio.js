// Prononciation des noms chinois du bestiaire : un mp3 par nom dans audio/noms/ (voir tools/gen-name-audio.py).
// Le fichier n'est téléchargé qu'au clic (ni précache ni cache du service worker) et seulement en ligne.
export const nameAudioId = hanzi => [...hanzi].map(c => c.codePointAt(0).toString(16)).join('-');
export const canPlayNameAudio = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let current = null;

// La musique baisse pendant la prononciation (pour bien entendre le mot) puis remonte quand elle se termine ou s'interrompt.
const DUCK_FACTOR = 0.2;
const DUCK_MAX_MS = 30000;   // garde-fou : la musique remonte de toute façon après ce délai
function duck(on) {
    import('./music.js').then(m => (on ? m.duckMusic(DUCK_FACTOR, DUCK_MAX_MS) : m.duckMusic(1, 0))).catch(() => {});
}

export function playNameAudio(hanzi, base = 'audio/noms/') {
    if (!hanzi || !canPlayNameAudio()) return;
    try {
        if (current) current.pause();
        const audio = new Audio(`${base}${nameAudioId(hanzi)}.mp3`);
        current = audio;
        const release = () => { if (current === audio) { current = null; duck(false); } };
        audio.addEventListener('ended', release);
        audio.addEventListener('pause', release);
        audio.addEventListener('error', release);
        duck(true);
        audio.play().catch(release);
    } catch { /* lecture impossible : on ignore */ }
}
