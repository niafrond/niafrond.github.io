---
name: blindtest-theme
description: Génère (ou corrige) un ou plusieurs thèmes pour /themes.json à partir de la bibliothèque réelle du serveur dj-mix, avec une vérification contradictoire obligatoire (agent indépendant) qui garantit que les 7 chansons d'un thème donnent 7 réponses différentes correspondant à la consigne. Utiliser quand on demande d'ajouter, de générer ou de corriger un thème de blind-test pour mix-blind-test.
---

# Générer un thème de blind-test (mix-blind-test)

Ce skill produit un ou plusieurs éléments du fichier `/themes.json` : un objet
`{ "theme": ..., "consigne": ..., "chansons": [7 × {titre, artiste, reponse}] }` construit à
partir de vraies chansons de la bibliothèque locale, puis validé par une **vérification
contradictoire** (un agent qui n'a pas participé à la génération) avant d'être intégré au fichier.

Chaque chanson doit porter un champ **`reponse`** explicite : la réponse exacte qu'un joueur
doit donner pour cette chanson précise, telle que la consigne du thème la définit. Ce n'est pas
un doublon du titre — c'est l'indice extrait (mot, expression, catégorie...) qui permet à un
game master de valider une réponse sans avoir à la redéduire lui-même en pleine partie. Exemple :

```json
{
  "theme": "Astres et ciel",
  "consigne": "Il faut donner le mot qui accompagne l'astre (étoile, lune, ciel) dans le titre",
  "chansons": [
    { "titre": "STAR WALKIN'", "artiste": "Lil Nas X", "reponse": "Walkin'" }
  ]
}
```

Le champ `reponse` est ce que la vérification contradictoire (étape 3) doit confronter : l'agent
audite indépendamment en dérivant lui-même la réponse depuis le titre, puis compare son résultat
au `reponse` écrit dans le brouillon — un écart entre les deux est en soi un signal d'échec (soit
le `reponse` est faux, soit la consigne est ambiguë et laisse place à plusieurs réponses
possibles, comme "Only" vs "Girl" pour "Only Girl (In The World)").

## 0. Pré-requis (à faire en tout début de session, par CLAUDE.md)

1. Consulter `http://127.0.0.1:3000/swagger.json` pour connaître les endpoints du serveur dj-mix.
2. Récupérer la bibliothèque réelle (sert de seule source de vérité pour les titres/artistes) :

```powershell
$resp = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/cache/files"
$resp.results | Select-Object trackName, artistName, genre | ConvertTo-Json -Depth 3 |
  Set-Content -Path "<scratchpad>\library.json" -Encoding utf8
```

Ne jamais inventer un titre ou un artiste : toute chanson utilisée doit être une ligne exacte
de cette bibliothèque (`trackName` + `artistName`).

## 1. La règle d'or : pas de réponse dupliquée

**Symptôme à bannir** : une consigne qui se contente de demander "est-ce que la chanson parle
de X ?" — dans ce cas, la réponse attendue est **X, répété 7 fois**, donc aucune chanson ne se
distingue des autres. Exemple de thème cassé :

> theme: "Ça part du cœur" — consigne: "il faut deviner que la chanson parle du cœur"
> → les 7 réponses sont toutes "cœur". Inutile.

**Référence de qualité** (à imiter) :

> theme: "Creatures" — consigne: "il faut donner le nom de la créature cachée dans le titre"
> → Chihuahua→chien, Barracuda→poisson, Buffalo Soldier→buffle, Le Chat→chat, Wolves→loup,
> Birds Of A Feather→oiseau, Alien→extraterrestre — **7 réponses différentes**.

### Technique de secours : l'extraction du qualificatif

Si les 7 chansons candidates partagent toutes un mot fixe dans leur titre (ex. "girl", "amour",
"one", "baby", "monde"/"world", "feu"/"fire"...), ne demande jamais "repère le mot partagé"
(réponse identique à chaque fois). Demande plutôt **le mot qui accompagne** ce mot fixe :

> "Barbie Girl"→Barbie, "Cosmic Girl"→Cosmic, "American Girl"→American — 7 qualificatifs
> différents même si "girl" est partout.

Cette technique résout la plupart des thèmes à mot-clé partagé sans avoir à changer les chansons.

### Pièges fréquents à vérifier soi-même avant l'envoi en vérification

- Deux titres qui donnent littéralement le même mot une fois le qualificatif extrait
  (ex. deux fois "In Your Eyes", ou "Toxic"/"Toxicity", ou deux "California ___").
- Une consigne binaire (chaud/froid, paradis/enfer, jour/nuit) où 5-6 chansons sur 7 tombent
  du même côté : le thème doit rester discriminant, pas juste "vrai/faux" répété.
- Une chanson dont le titre ne contient aucun élément exploitable pour la consigne (ex. un
  thème "villes" avec un titre qui ne nomme aucune ville) — dans ce cas, remplace-la par une
  autre chanson réelle de la bibliothèque plutôt que de forcer une réponse vague.
- Une chanson déjà utilisée dans un autre thème du fichier (à éviter, vérifier le fichier entier).
- Un `reponse` vide, ou qui n'est qu'une reformulation du `theme`/de la `consigne` au lieu de
  l'indice précis extrait du titre.

## 2. Génération du brouillon

Pour chaque thème demandé :

1. Choisis un nom de thème (peut être un mot, une question, une phrase — voir les exemples
   existants dans `/themes.json` pour le ton attendu).
2. Cherche dans la bibliothèque (grep sur `library.json` / le texte des titres) des chansons
   dont le titre porte un indice exploitable pour ce thème.
3. Rédige une consigne qui, appliquée à chacune des 7 chansons, produit un indice **différent**
   à chaque fois (utilise la technique du qualificatif si besoin).
4. Renseigne le champ `reponse` de chaque chanson avec cet indice exact (pas une paraphrase :
   le mot/l'expression tel qu'il doit être reconnu si un joueur le dit).
5. Vérifie toi-même une première fois (rapide) qu'aucune des 7 valeurs de `reponse` ne se répète
   et que chaque titre+artiste est une ligne exacte de `library.json`.

Ce brouillon n'est **pas encore validé** — l'étape 3 est obligatoire avant intégration.

## 3. Vérification contradictoire (obligatoire, non optionnelle)

Lance un agent indépendant (outil `Agent`, `subagent_type: general-purpose`) qui n'a **aucune
connaissance du raisonnement de génération**. Donne-lui le thème brut complet, `reponse` incluse
— il ne s'agit pas de lui cacher le champ `reponse`, mais de lui faire **redériver chaque réponse
lui-même depuis le titre d'abord**, puis comparer à ce qui est écrit, exactement comme un
correcteur qui vérifie un corrigé plutôt que de le recopier en confiance.

Modèle de prompt à adapter :

```
Tu audites un thème de blind-test musical français, en lecture seule.

Thème : "<nom>"
Consigne : "<consigne>"
Chansons :
1. <titre> — <artiste> — reponse indiquée : "<reponse>"
2. <titre> — <artiste> — reponse indiquée : "<reponse>"
... (7 au total)

Bibliothèque de référence (vérité terrain) : <chemin vers library.json>

Pour chaque chanson, déduis D'ABORD toi-même, à partir du seul texte du titre (ignore la
"reponse indiquée" tant que tu n'as pas fini cette étape), quelle réponse un joueur donnerait en
appliquant la consigne. Compare ensuite ta déduction à la "reponse indiquée" fournie.

Vérifie :
1. Les 7 réponses que TU as déduites sont-elles réellement toutes différentes les unes des
   autres ?
2. Chaque réponse déduite correspond-elle bien à l'esprit de la consigne (pas hors-sujet) et à
   un mot/expression concret, raisonnablement devinable par un joueur (pas une préposition
   creuse ni un fragment de phrase ambigu) ?
3. Ta déduction correspond-elle exactement à la "reponse indiquée" pour cette chanson ? Un écart
   est un échec en soi (reponse fausse, ou consigne ambiguë permettant plusieurs réponses).
4. Chaque titre+artiste existe-t-il exactement (même orthographe) dans library.json ?

Réponds par un verdict : OK, ou ÉCHEC avec le détail précis du problème (quelles chansons
entrent en collision, quelle réponse déduite diffère de la reponse indiquée, quel titre est
introuvable). Si ÉCHEC, propose une correction : soit une reformulation de consigne (technique du
qualificatif si un mot est partagé) avec la reponse corrigée pour chaque chanson concernée, soit
le remplacement d'une chanson précise par une autre chanson réelle et vérifiée de library.json
(jamais une chanson inventée), reponse incluse.

C'est un audit en lecture seule : ne modifie aucun fichier.
```

Lance cet agent en foreground (`run_in_background: false`) si un seul thème est en jeu — la
suite du travail en dépend directement. Pour plusieurs thèmes à la fois, découpe en lots (comme
lors de l'audit initial du fichier : ~8 thèmes par agent, tous en parallèle, en arrière-plan).

## 4. Boucle correctrice

- Si le verdict est ÉCHEC, applique la correction proposée (reformulation et/ou remplacement de
  chanson vérifiée) et relance une vérification contradictoire sur la version corrigée.
- Répète jusqu'à un verdict OK. Ne jamais intégrer un thème qui n'a pas reçu de verdict OK.
- Si aucune formulation ni aucun remplacement ne permet d'obtenir 7 réponses distinctes avec le
  contenu disponible dans la bibliothèque, abandonne ce thème plutôt que de forcer un thème
  bancal — propose un thème de remplacement entièrement différent.

## 5. Intégration dans `/themes.json`

1. Ajoute l'objet thème validé au tableau `themes`.
2. Revalide l'ensemble du fichier (pas seulement le nouveau thème) :

```powershell
$lib = Get-Content "<scratchpad>\library.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$themes = Get-Content "mix-blind-test\themes.json" -Raw -Encoding UTF8 | ConvertFrom-Json
function Norm($s) { return ($s -replace '\s*,\s*', ',').Trim() }
$libSet = @{}
foreach ($t in $lib) { $libSet["$(Norm $t.trackName)|$(Norm $t.artistName)"] = $true }
$missing = @(); $allKeys = @()
foreach ($th in $themes.themes) {
  if ($th.chansons.Count -ne 7) { "THEME AVEC != 7 CHANSONS: $($th.theme)" }
  $reponsesVides = $th.chansons | Where-Object { [string]::IsNullOrWhiteSpace($_.reponse) }
  if ($reponsesVides) { "THEME AVEC REPONSE(S) VIDE(S): $($th.theme)" }
  $reponsesDup = $th.chansons | Group-Object { (Norm $_.reponse).ToLower() } | Where-Object { $_.Count -gt 1 }
  if ($reponsesDup) { "THEME AVEC REPONSES EN COLLISION: $($th.theme) -> $((($reponsesDup | ForEach-Object {$_.Name}) -join ' / '))" }
  foreach ($s in $th.chansons) {
    $key = "$(Norm $s.titre)|$(Norm $s.artiste)"
    $allKeys += [PSCustomObject]@{ Theme = $th.theme; Key = $key }
    if (-not $libSet.ContainsKey($key)) { $missing += [PSCustomObject]@{ Theme = $th.theme; Titre = $s.titre; Artiste = $s.artiste } }
  }
}
"manquants: $($missing.Count)"; $missing | Format-Table -AutoSize
$dups = $allKeys | Group-Object Key | Where-Object { $_.Count -gt 1 }
"doublons inter-thèmes: $($dups.Count)"
$dups | ForEach-Object { "$($_.Name) -> $((($_.Group | ForEach-Object {$_.Theme}) -join ' / '))" }
```

Le script signale aussi, par thème, les `reponse` vides et les collisions de `reponse` (deux
chansons du même thème dont la réponse normalisée — casse ignorée — est identique).

3. Si des doublons inter-thèmes apparaissent (chanson déjà utilisée ailleurs dans le fichier),
   remplace-la dans le nouveau thème par une alternative vérifiée, puis relance la validation.
4. Nettoie les fichiers temporaires du scratchpad une fois terminé.

## Sortie attendue

À la fin, communique à l'utilisateur : le(s) thème(s) ajouté(s), le nombre total de thèmes dans
le fichier, et la confirmation que la vérification contradictoire a validé chaque thème (verdict
OK obtenu, éventuellement après corrections).
