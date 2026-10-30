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
    wanderingSouls: { enabled: true }   // false pour désactiver
};
```

Puis committer. Désactiver n'ajoute plus aucun écran ni aucune quête de l'événement ; les sauvegardes, quêtes terminées et récompenses
déjà acquises ne sont jamais supprimées. Une sauvegarde qui se trouvait dans un écran de l'événement revient à l'écran de départ
(comportement de `createSession` pour tout écran inconnu) ; sa progression de quête est conservée pour une réactivation.

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
