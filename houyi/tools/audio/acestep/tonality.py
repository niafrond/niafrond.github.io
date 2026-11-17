#!/usr/bin/env python3
"""
tonality.py — repère les notes hors tonalité et les passages désaccordés d'une piste générée, sans l'écouter.

    python3 tonality.py <fichier.mp3…> [--key "D minor"] [--win 4] [--limit 0.30]

Pour chaque fichier :
  - `hors` : part de l'énergie harmonique (chromagramme) sur les 5 notes qui ne sont pas dans la gamme de la tonalité déclarée
    (gamme mineure naturelle + sensible, ou majeure ; la quinte et la tierce des harmoniques restent tolérées) ;
  - les fenêtres de `--win` secondes dont la part hors gamme dépasse `--limit`, ou dépasse de 0,12 la médiane de la piste
    (premier passage suspect = fausse note ou instrument désaccordé), sont listées avec leur horodatage ;
  - `accord` : écart (en centièmes de ton) de l'accord de la piste par rapport au La 440 Hz, global et par fenêtre ; plus de 30
    centièmes sur une fenêtre signale un instrument désaccordé ;
  - `tonalité estimée` : meilleure tonalité d'après le profil de Krumhansl, à comparer à celle du catalogue.

La tonalité est lue dans `--key`, sinon dans le `.json` voisin (`request.key_scale` : sorties de `out/` et de `approved/`),
sinon dans `approved/<nom>.json` pour les MP3 installés dans `audio/music/`.
Code de sortie 1 si au moins une piste a des passages suspects (utilisable comme garde avant `approve`).
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np
import librosa

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10, 11]   # mineure naturelle + sensible (harmonique)
KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
HERE = os.path.dirname(os.path.abspath(__file__))


def parse_key(text):
    """'D minor', 'F# major', 'C# minor' -> (pitch class, mode) ou None."""
    if not text:
        return None
    parts = text.replace('♯', '#').replace('♭', 'b').split()
    if len(parts) < 2:
        return None
    flats = {'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'}
    name = flats.get(parts[0], parts[0])
    if name not in NOTES:
        return None
    return NOTES.index(name), ('minor' if parts[1].lower().startswith('min') else 'major')


def find_key(path):
    base, _ = os.path.splitext(path)
    for cand in (base + '.json', os.path.join(HERE, 'approved', os.path.basename(base) + '.json')):
        if os.path.exists(cand):
            try:
                with open(cand, encoding='utf8') as f:
                    k = json.load(f).get('request', {}).get('key_scale')
                if k:
                    return k
            except (OSError, ValueError):
                pass
    return None


def scale_mask(tonic, mode):
    mask = np.zeros(12, bool)
    for d in (MAJOR if mode == 'major' else MINOR):
        mask[(tonic + d) % 12] = True
    return mask


def best_key(chroma_mean):
    best = (-2, None)
    for t in range(12):
        for mode, prof in (('major', KS_MAJOR), ('minor', KS_MINOR)):
            c = np.corrcoef(chroma_mean, np.roll(prof, t))[0, 1]
            if c > best[0]:
                best = (c, (t, mode))
    return best[1]


def tuning_of(y, sr):
    """Écart d'accord (demi-tons, [-0,5 ; 0,5[) : moyenne circulaire des écarts des pics spectraux à la grille La 440 Hz.
    Calcul maison (numpy/scipy) : `librosa.estimate_tuning` plante (numba) sur certaines installations."""
    n_fft = 4096
    if len(y) < n_fft * 2:
        return 0.0
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=n_fft // 2))
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    lo, hi = np.searchsorted(freqs, 100), np.searchsorted(freqs, 2000)
    band = S[lo:hi]
    peaks = (band[1:-1] > band[:-2]) & (band[1:-1] >= band[2:]) & (band[1:-1] > 0.2 * band.max(axis=0, keepdims=True))
    idx, frm = np.nonzero(peaks)
    idx += 1
    a, b, c = band[idx - 1, frm], band[idx, frm], band[idx + 1, frm]
    den = a - 2 * b + c
    off = np.where(np.abs(den) > 1e-9, 0.5 * (a - c) / den, 0.0)
    f = freqs[lo + idx] + off * (freqs[1] - freqs[0])
    dev = 12 * np.log2(f / 440.0)
    dev = dev - np.round(dev)
    ang = 2 * np.pi * dev
    w = b
    return float(np.angle(np.sum(w * np.exp(1j * ang))) / (2 * np.pi))


def fmt_time(s):
    return f'{int(s // 60)}:{int(s % 60):02d}'


def analyse(path, key_text, win, limit):
    sr = 22050   # décodage par ffmpeg (la lecture MP3 de librosa plante sur certaines installations)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).copy()
    yh = librosa.effects.harmonic(y, margin=3.0)
    tuning = tuning_of(yh, sr)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=yh, sr=sr, hop_length=hop, tuning=tuning)
    fps = sr / hop
    n = chroma.shape[1]
    per = max(1, int(win * fps))
    parsed = parse_key(key_text)
    est = best_key(chroma.mean(axis=1))
    print(f'{path}')
    print(f'  tonalité déclarée : {key_text or "inconnue"}   estimée : {NOTES[est[0]]} {est[1]}   accord global : {tuning * 100:+.0f} centièmes')
    if not parsed:
        print('  (pas de tonalité déclarée : seul l\'accord est contrôlé, indiquer --key pour le reste)')
    spans = [(i, chroma[:, i:i + per].mean(axis=1)) for i in range(0, n - per + 1, per)]

    def ratios_for(mask):
        return [float(c[~mask].sum() / (c.sum() or 1.0)) for _, c in spans]

    mask = scale_mask(*parsed) if parsed else None
    ratios = ratios_for(mask) if mask is not None else []
    # ACE-Step ne respecte pas toujours la tonalité demandée : si la piste colle nettement mieux à la tonalité estimée,
    # on juge les fausses notes par rapport à celle-ci (une piste entière « hors gamme » est un écart de tonalité, pas une fausse note)
    if mask is not None and spans:
        est_mask = scale_mask(*est)
        est_ratios = ratios_for(est_mask)
        if np.mean(est_ratios) + 0.05 < np.mean(ratios):
            print(f'  ! la piste ne suit pas la tonalité du catalogue ({np.mean(ratios) * 100:.0f} % hors gamme) : jugée selon {NOTES[est[0]]} {est[1]} ({np.mean(est_ratios) * 100:.0f} %)')
            mask, ratios = est_mask, est_ratios
    wins = []
    for (i, _), out in zip(spans, ratios if mask is not None else [0.0] * len(spans)):
        seg = yh[int(i * hop):int((i + per) * hop)]
        t = tuning_of(seg, sr) if len(seg) > sr else tuning
        wins.append((i / fps, out, t))
    flagged = []
    if mask is not None and ratios:
        med = float(np.median(ratios))
        print(f'  hors gamme : {np.mean(ratios) * 100:.0f} % en moyenne (médiane {med * 100:.0f} %)')
    for (t0, out, tun) in wins:
        why = []
        if mask is not None and (out > limit or out > (np.median(ratios) + 0.12)):
            why.append(f'{out * 100:.0f} % hors gamme')
        if abs(tun - tuning) * 100 > 30:
            why.append(f'désaccord {abs(tun - tuning) * 100:.0f} centièmes')
        if why:
            flagged.append((t0, why))
    if flagged:
        for t0, why in flagged:
            print(f'  ! {fmt_time(t0)}–{fmt_time(t0 + win)}  ' + ', '.join(why))
    else:
        print('  aucun passage suspect')
    return bool(flagged)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='+')
    ap.add_argument('--key', help='tonalité attendue, ex. "D minor" (sinon lue dans le .json voisin)')
    ap.add_argument('--win', type=float, default=4.0, help='durée des fenêtres en secondes')
    ap.add_argument('--limit', type=float, default=0.30, help='part hors gamme à partir de laquelle une fenêtre est suspecte')
    a = ap.parse_args()
    bad = False
    for f in a.files:
        bad |= analyse(f, a.key or find_key(f), a.win, a.limit)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
