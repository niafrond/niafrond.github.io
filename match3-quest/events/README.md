# Événements temporaires

Contenu facultatif activé ou désactivé **par commit Git** : aucune date, aucun serveur, aucune commande en jeu, aucun compte à rebours.

## Trois couches

| Couche | Fichiers | Rôle |
|---|---|---|
| A. Moteur | `config.js`, `engine.js`, `registry.js` | Activation par configuration, appel des modules activés, marquage (`screen.event`, `quest.event`). Générique : ne connaît aucun événement. |
| B. Données | `<événement>/data.js`, `<événement>/index.js` | Nom, grille, quêtes, objets, ennemis, dialogues ; `index.js` applique ces données au monde assemblé. |
| C. Variantes visuelles | _(pas encore implémentée : le jeu n'a pas de système de skins)_ | Skins, palettes, sprites, effets propres à un événement. |

## Activer / désactiver

Dans `events/config.js` :

```js
export const EVENTS = {
    wanderingSouls: { enabled: true },          // false pour désactiver
    winterLanternFestival: { enabled: false }   // préparé, inactif : true puis commit pour le lancer
};
```

Puis committer. Désactiver n'ajoute plus aucun écran ni aucune quête de l'événement ; les sauvegardes, quêtes terminées et récompenses
déjà acquises ne sont jamais supprimées. Une sauvegarde qui se trouvait dans un écran de l'événement revient à l'écran de départ
(comportement de `createSession` pour tout écran inconnu) ; sa progression de quête est conservée pour une réactivation.

### Forcer un événement par l'URL (test, session en cours)

`index.html?events=winterLanternFestival` active l'événement ; `?events=-wanderingSouls` désactive l'autre ; combinables avec une virgule
(`?events=winterLanternFestival,-wanderingSouls`). L'URL n'est lue **qu'une fois**, au chargement de la page ; le choix est gardé dans
`sessionStorage` (rechargements du même onglet) et disparaît à la fermeture de l'onglet. `?events=` (vide) efface la surcharge. Le fichier
`config.js` reste la seule configuration versionnée. Les événements inconnus sont ignorés ; un monde déjà construit n'est pas reconstruit.

## Événements présents

| Id | Contenu | État |
|---|---|---|
| `wanderingSouls` | La Nuit des âmes errantes : royaume des morts, 6 terrains, 4 quêtes | actif |
| `winterLanternFestival` | La Fête des lanternes d'hiver : village, col et sanctuaire de montagne, 6 quêtes ; prompts de ressources dans `winterLanternFestival/prompts-gm.md` | inactif |

## Ajouter un événement

1. Créer `events/<id>/data.js` (données) et `events/<id>/index.js` qui exporte `{ id, apply(screens, quests) }`.
   `apply` ajoute écrans et quêtes au monde assemblé ; il retourne `false` (sans rien modifier) si son écran hôte n'existe pas.
   Réutiliser `world/mapKit.js` (`buildZone`), `world/legends.js` (`placeSafely`) et le modèle de `world/underground.js`.
2. Déclarer le module dans `events/registry.js` et sa configuration dans `events/config.js`.
3. Ajouter les fichiers à l'import map de `index.html`, puis lancer `npm run precache:build` (le cœur du précache liste `events/`).
4. Si un nouveau biome est nécessaire : une entrée dans `BIOMES` (`explorationView.js`) et `BIOME_DECOR` (`decor.js`), en réutilisant des décors existants.
5. Écrire les tests (`tests/unit/events.test.js` sert de modèle : activé, désactivé, sauvegarde, parcours de quêtes).
6. Mettre à jour `SPECS.md`.

Les identifiants d'un événement (écrans, quêtes, coffres, PNJ, ennemis) sont **stables** d'une version à l'autre : c'est ce qui permet
la réactivation sans duplication d'objets ni perte de progression.
