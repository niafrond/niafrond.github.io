# flash-guess — Spécifications

Spécifications et journal de session de `flash-guess/`.

- 2026-10-24 (mesure d'audience GoatCounter) : à la demande de l'utilisateur, sur tout le site. Script `data-goatcounter="https://niafrond.goatcounter.com/count"` (`//gc.zgo.at/count.js`, async) ajouté avant `</head>` des pages HTML.

- 2026-11-07 (mesure d'audience) : GoatCounter remplacé par `https://stats.fontaine.one/count.js` (mesure maison sans cookie ni identifiant, voir `stats/SPECS.md`) dans `index.html`.

- 2026-11-09 (mise à jour APK) : les mises à jour ne fonctionnaient plus car l'APK n'était pas joint aux dernières releases (`releases/latest/download/flash-guess.apk` en 404). Un workflow par appli (`apk.yml`) publie désormais l'APK sur une release roulante dédiée au tag fixe `apk-flash-guess` (prerelease, jamais « latest », indépendante de semantic-release) ; la version de l'APK est dans le corps de la release. `pwa.js` (`APK_URL`, `APK_VERSION_API`, lecture du corps), le lien de `index.html` et le repli de `ApkUpdaterPlugin.java` pointent vers ce tag.
