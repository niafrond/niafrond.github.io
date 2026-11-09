# Prompt « Battle 1 » : génération en un seul tenant (sans compositeur)

Thème de combat inspiré de l'analyse de composition de *Final Fantasy IX — Battle 1* (moteur rythmique, mélodie héroïque
qui monte et reste ouverte, relance à l'octave), joué par des **instruments chinois traditionnels uniquement**.
Génération directe par ACE-Step, avec `generate.mjs` : un seul morceau, tous les instruments dans la même passe.

## Paramètres

| Champ ACE-Step | Valeur |
|---|---|
| `bpm` | 160 |
| `key_scale` | `A minor` |
| `time_signature` | `4` |
| `audio_duration` | 180 (le script impose au moins 180 s ; `install` coupe ensuite sur la boucle) |
| `lyrics` | `[Instrumental]` |
| `vocal_language` | `unknown` |
| `batch_size` | 1 (les lots de plusieurs variantes ont bloqué le serveur ; générer une variante à la fois) |

## Prompt (champ `prompt`, en anglais)

```
traditional Chinese heroic martial battle theme, instrumental, fast and driving, A minor, 160 bpm, 4/4, loopable,
starts instantly at full energy on the first beat, no intro, no fade-in,
authentic traditional acoustic Chinese instruments only, organic natural dynamics,
rhythm engine: fast pipa repeated eighth-note ostinato (A E A E, A E G E) running through the whole piece,
guzheng arpeggios and a low guzheng bass line moving Am - F - G - Am,
sheng sustained chords underneath,
lead melody: soaring heroic erhu, short memorable motif, climbing to a high peak and ending on an open phrase so the loop restarts,
dizi counter-melody only in the gaps of the lead, never doubling it,
suona fanfare phrases answering the erhu, with rests between them,
deep tangu war drums with syncopated accents, restrained gongs and cymbal crashes on phrase ends,
structure: strong opening, steady driving verse, answering call-and-response section, powerful climax,
second half repeats the motif an octave higher with denser pipa and louder suona,
ends open and unresolved so it loops without a conclusion,
defiant and heroic rather than tragic, tension and exaltation,
no electric guitar, no rock drum kit, no synthesizer, no electronic drums, no EDM, no western strings, no western brass, no vocals
```

## Contre-indications à garder dans le prompt

- Ne pas écrire « rock » ni « orchestral trailer » : ACE-Step y répond par une batterie et des cordes occidentales.
- Une seule mélodie soliste à la fois : demander explicitement que le contre-chant et la fanfare restent dans les creux.
- La mélodie ne sera pas celle de FF9. Le texte donne le caractère (contour, relance, boucle ouverte), pas les notes.

## Lancer la génération

Depuis `match3-quest/tools/audio/acestep`, serveur lancé (`tools/gm up audio`).

**1. Avec le style du catalogue (piste `combat-0`) : le prompt ci-dessus s'ajoute au style global**

```
node generate.mjs generate combat-0 --variants 1 --no-motif --extra "<texte du prompt, sur une ligne>"
```

**2. Prompt exact, sans style ajouté : déclarer une entrée dans `catalog.mjs` (comme `combat-0-b`) avec `raw: true`**

```js
T('combat-0-c', `<texte du prompt, sur une ligne>`,
    { bpm: 160, keyScale: 'A minor', dur: 180, raw: true });
```

puis `node generate.mjs generate combat-0-c --variants 1`.

Écouter dans `out/<clé>/vNNN.mp3`, puis `node generate.mjs approve <clé> <vNNN>` et `node generate.mjs install`.

## Pour varier

Changer un seul paramètre à la fois et relancer avec une autre graine (`--seed N`) :

- tempo : 148 à 172 ;
- instrument de la mélodie : erhu, dizi, xiao, pipa, ou erhu et dizi à l'unisson ;
- progression : `Am - F - G - Am`, `Am - Dm - G - Am`, `Am - C - G - Am`, `Am - F - C - G` ;
- instrument de l'ostinato : pipa, yangqin ou guzheng.
