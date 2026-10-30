# Spécification complète — Événement temporaire « La Nuit des âmes errantes »
## Jeu : Hou Yi et les 10 Soleils

## 1. Objectif du projet

Créer un événement temporaire facultatif intitulé **« La Nuit des âmes errantes »**, inspiré des traditions chinoises relatives aux esprits, aux fantômes, aux rites funéraires et au monde des morts.

L'événement doit proposer une expérience complète, comprenant :
- Un biome événementiel inédit.
- Une direction artistique spécifique.
- Des ennemis et personnages exclusifs.
- Des objets utilisables en jeu.
- Des quêtes et des énigmes.
- Des mécaniques de gameplay surnaturelles.
- Des récompenses facultatives.
- Des variantes visuelles pour certains personnages, équipements et éléments de décor.
- Une architecture technique réutilisable pour de futurs événements.

L'événement doit s'intégrer naturellement dans l'univers de **Hou Yi et les 10 Soleils**, sans modifier la progression principale ni imposer de contenu aux joueurs.

Le contenu doit être conçu pour être activé et désactivé par modification du code source, suivie d'un commit dans le dépôt Git.

## 2. Contraintes techniques

Le jeu est développé en HTML, CSS et JavaScript, sans serveur ni backend.

Respecter impérativement les contraintes suivantes :
- Aucun serveur, aucune API distante et aucune base de données distante.
- Aucune dépendance réseau pour jouer à l'événement.
- Aucune activation automatique fondée sur la date ou l'heure.
- Aucun compte à rebours ou mécanisme de pression temporelle.
- Aucune commande en jeu pour activer ou désactiver l'événement.
- Aucune réécriture générale du moteur de jeu.
- Aucune modification inutile des systèmes permanents.

Avant toute implémentation, examiner le dépôt, comprendre l'architecture actuelle et identifier les systèmes existants de cartes, de tilesets, de collisions, d'objets, d'ennemis, de quêtes, d'interface et de sauvegarde.

Réutiliser ces systèmes autant que possible. Ne pas supposer qu'un moteur, une bibliothèque ou une structure de fichiers particulière existe sans avoir inspecté le projet.

## 3. Activation par commit Git

L'événement est activé exclusivement par une modification de configuration dans le code source, suivie d'un commit.

Prévoir une configuration centralisée permettant de contrôler les événements.

Exemple conceptuel :

```js
const EVENTS = {
  wanderingSouls: {
    enabled: true
  }
};
```

Adapter cet exemple à la structure réelle du projet.

Pour activer l'événement, modifier son paramètre d'activation et committer le changement.

Pour le désactiver, repasser ce paramètre à `false` et committer le changement.

Lorsque l'événement est désactivé :
- Le biome événementiel ne doit plus être accessible par les moyens normaux du jeu.
- Les ennemis et les quêtes propres à l'événement ne doivent plus apparaître dans les nouvelles parties de contenu.
- Les variantes visuelles temporaires doivent cesser d'être appliquées.
- Le jeu permanent doit continuer à fonctionner normalement.
- Les sauvegardes et les récompenses permanentes doivent être conservées.

Ne pas supprimer automatiquement les données de sauvegarde ou les ressources lors de la désactivation.

Ne pas effectuer de commit sans demande explicite.

## 4. Identité et scénario de l'événement

**Nom :** La Nuit des âmes errantes

**Thème :** une nuit mystérieuse pendant laquelle la frontière entre le monde des vivants et celui des morts devient fragile.

Des sceaux protecteurs ont été brisés dans un lieu ancien. Les esprits qui y étaient contenus se répandent dans les ruines et les paysages environnants. Certaines âmes sont hostiles, d'autres sont perdues, et quelques-unes cherchent simplement à terminer une tâche qu'elles n'ont jamais pu accomplir de leur vivant.

Le joueur découvre l'existence de ce lieu à travers un indice, un personnage ou un point d'intérêt facultatif.

Il doit retrouver des talismans, rallumer des lanternes, résoudre des énigmes et restaurer les sceaux qui séparent les deux mondes.

Le scénario doit rester autonome. Il peut enrichir l'univers mythologique du jeu, mais ne doit pas modifier les événements fondamentaux de l'histoire principale de Hou Yi.

Ne pas présenter tous les esprits comme intrinsèquement mauvais : le joueur doit pouvoir combattre certains ennemis, en éviter d'autres et apaiser quelques âmes par l'exploration ou les quêtes.

## 5. Références culturelles chinoises

Les références suivantes doivent servir de sources d'inspiration cohérentes, et non de simples éléments décoratifs mélangés sans distinction.

### 5.1. Le festival des fantômes — Zhongyuan Jie (中元节)

Le Zhongyuan Jie est associé, dans différentes traditions chinoises, aux rites destinés aux défunts et aux esprits.

Éléments à adapter :
- Lanternes guidant les âmes.
- Offrandes symboliques.
- Temples et sanctuaires.
- Rites d'apaisement.
- Esprits incapables de trouver le repos.
- Chemins qui apparaissent dans la brume.
- Sceaux protégeant certains lieux.

Le jeu doit en proposer une interprétation fantastique adaptée à son univers, sans prétendre reproduire exactement une cérémonie religieuse réelle.

### 5.2. Zhong Kui (钟馗), le pourfendeur de démons

Figure légendaire associée à la protection contre les démons.

Utilisations possibles :
- Protecteur d'un sanctuaire.
- Personnage donnant une quête.
- Gardien d'une épreuve facultative.
- Boss ou adversaire soumis à des conditions particulières.

Direction visuelle : robe traditionnelle, barbe imposante, regard sévère, épée et présence autoritaire.

### 5.3. Les talismans taoïstes (符箓)

Papiers rituels marqués de signes servant d'inspiration aux mécaniques de scellement.

Utilisations :
- Bloquer temporairement un revenant.
- Ouvrir ou fermer un passage surnaturel.
- Révéler des inscriptions invisibles.
- Déverrouiller des mécanismes.
- Résoudre des puzzles d'orientation ou d'association de symboles.

Éviter d'utiliser des inscriptions religieuses authentiques de façon arbitraire. Des symboles fictifs conçus pour le jeu peuvent être préférables.

### 5.4. Les lanternes spirituelles

Elles constituent le motif visuel central de l'événement.

Utilisations :
- Éclairer des chemins invisibles.
- Révéler des ennemis cachés.
- Guider des âmes.
- Activer des mécanismes.
- Indiquer une progression dans le biome.

### 5.5. Le monde des morts

S'inspirer de représentations traditionnelles du jugement des défunts et des autorités des Enfers chinois.

Utiliser notamment :
- Des portes monumentales.
- Des registres des âmes.
- Des salles de jugement.
- Des gardiens surnaturels.
- Des chemins séparant les vivants des morts.

Ne pas transformer automatiquement ces éléments en copies d'un enfer occidental médiéval.

## 6. Biome événementiel dédié

Créer un nouveau biome entièrement facultatif.

**Nom français :** Le Royaume des âmes errantes

**Identifiant technique proposé :** `wandering_souls`

L'identifiant doit être vérifié par rapport aux conventions du projet avant son adoption.

Ce biome doit posséder son propre tileset, sa palette, ses éléments de décor, ses points d'intérêt et ses mécaniques.

Il ne doit pas nécessiter de transformer définitivement les onze biomes permanents du jeu.

### 6.1. Accès au biome

L'accès doit être facultatif et intégré à l'exploration.

Pistes possibles :
- Un ancien sanctuaire qui apparaît dans certaines conditions.
- Une porte rituelle cachée.
- Un passage révélé par une lanterne.
- Un autel activable après avoir trouvé un talisman.
- Un point d'entrée scénarisé accessible depuis une zone existante.

Choisir la solution qui correspond le mieux aux systèmes déjà présents.

Lorsque l'événement est désactivé, le point d'accès ne doit pas apparaître dans les nouvelles sessions de jeu. Si une sauvegarde contient déjà une référence au biome, la désactivation ne doit pas provoquer de plantage ni supprimer la progression du joueur.

### 6.2. Sols du biome

Prévoir :
- Pierre sombre.
- Dalles anciennes fissurées.
- Terre grisâtre.
- Pavés humides.
- Sol couvert de feuilles mortes.
- Sols marqués par des sceaux.
- Passages de pierre suspendus.
- Dalles illuminées par les lanternes.
- Zones couvertes de brume.

### 6.3. Reliefs

Prévoir :
- Escaliers monumentaux.
- Falaises sombres.
- Ponts de pierre.
- Plateformes suspendues.
- Ravins noyés dans la brume.
- Terrasses de temples.
- Petites îles rocheuses.
- Portes gigantesques.
- Passages dissimulés derrière des murs ou des cascades surnaturelles.

### 6.4. Obstacles

Prévoir :
- Statues de gardiens.
- Stèles gravées.
- Colonnes brisées.
- Racines noires.
- Urnes anciennes.
- Portes scellées.
- Blocs de pierre déplaçables.
- Barrières spirituelles.
- Lanternes éteintes.
- Miroirs rituels.

Les éléments interactifs doivent être visuellement distincts des éléments purement décoratifs.

### 6.5. Décoration

Prévoir :
- Lanternes rouges suspendues.
- Lanternes flottantes.
- Talismans de papier.
- Clochettes anciennes.
- Encensoirs.
- Fleurs pâles.
- Lucioles surnaturelles.
- Plumes noires.
- Ombres fugaces.
- Traces de pas lumineuses.
- Poussière flottante.
- Statues de lions gardiens.
- Offrandes abandonnées.
- Sceaux gravés dans la pierre.

### 6.6. Architecture

Prévoir :
- Temples traditionnels chinois.
- Portes monumentales à toits courbés.
- Pavillons abandonnés.
- Ponts de pierre sculptés.
- Autels.
- Sanctuaires de gardiens.
- Salles de jugement.
- Archives des âmes.
- Pavillons rituels.
- Tours de guet.
- Escaliers de pierre menant à des plateformes suspendues.

L'architecture doit conserver une identité chinoise reconnaissable. Éviter les châteaux gothiques et les architectures funéraires occidentales.

### 6.7. Éléments spéciaux

Prévoir :
- Lanternes qui révèlent des passages.
- Sceaux à restaurer.
- Portes qui ne s'ouvrent qu'après un rite.
- Plateformes visibles uniquement à la lumière.
- Ombres qui imitent les mouvements du joueur.
- Miroirs révélant une autre version d'une salle.
- Esprits à guider vers une sortie.
- Ponts apparaissant lorsque plusieurs lanternes sont allumées.
- Courants de brume déplaçant des objets légers.
- Pièces qui changent d'apparence lorsque le joueur détourne le regard.

Ces mécaniques doivent réutiliser les capacités existantes du jeu lorsque cela est possible.

## 7. Palette de couleurs

Utiliser une palette cohérente pour le biome et ses ressources.

| Couleur | Code indicatif | Usage |
|---|---|---|
| Rouge cinabre | `#B52B32` | Lanternes, sceaux et portes |
| Noir encre | `#171A24` | Ombres, architecture et silhouettes |
| Vert fantôme | `#78B8A0` | Esprits et flammes surnaturelles |
| Or vieilli | `#B99A58` | Reliques, détails sacrés et ornements |
| Bleu nuit | `#273B59` | Brume, eau et arrière-plans |
| Papier ancien | `#D8C69D` | Talismans, parchemins et os |
| Jade sombre | `#315F54` | Statues et éléments spirituels |
| Gris pierre | `#686A70` | Dalles, ruines et escaliers |

Ces codes sont des valeurs de départ à ajuster à la direction artistique réelle du jeu.

Éviter une saturation excessive des effets lumineux. Les lanternes et les éléments interactifs doivent rester visibles sans rendre les cases difficiles à distinguer.

## 8. Ennemis et personnages exclusifs

### 8.1. Jiangshi (僵尸) — Revenant sauteur

Type : ennemi de combat.

Apparence :
- Vêtements traditionnels anciens.
- Peau pâle ou grisâtre.
- Talisman posé sur le front.
- Mouvement rigide et bonds caractéristiques.

Comportements possibles :
- Avancer par bonds.
- Immobiliser brièvement le joueur.
- Être paralysé par un talisman.
- Se réveiller lorsque le joueur s'approche trop près.

### 8.2. Fantôme affamé

Type : ennemi ou personnage pouvant être apaisé.

Apparence :
- Silhouette émaciée.
- Vêtements déchirés.
- Mouvement flottant.
- Aura discrète.

Comportements possibles :
- Poursuivre certains objets.
- Se nourrir d'une énergie surnaturelle.
- Être apaisé par une quête ou une offrande.
- Récompenser le joueur s'il est libéré sans combat.

### 8.3. Zhong Kui (钟馗)

Type : personnage spécial, gardien ou boss facultatif.

Apparence :
- Barbe imposante.
- Robe traditionnelle.
- Épée.
- Posture autoritaire.

Son rôle doit être défini selon le scénario. Ne pas le rendre automatiquement hostile : sa fonction de protecteur peut être plus intéressante qu'un combat systématique.

### 8.4. Huli jing (狐狸精) — Renard-esprit

Type : personnage rusé ou ennemi d'illusion.

Comportements possibles :
- Créer de faux passages.
- Imiter un personnage connu.
- Modifier temporairement l'apparence de certains objets.
- Proposer des énigmes ou des dialogues à choix.
- Révéler un secret si le joueur comprend son intention.

### 8.5. Gardien du jugement

Type : boss facultatif inspiré des figures du jugement des morts, notamment Yanluo Wang (阎罗王).

Il peut mettre à l'épreuve les choix du joueur, protéger les archives des âmes ou défendre un sceau.

Le combat peut comporter plusieurs phases et des mécaniques liées aux lanternes et aux talismans.

Ne pas en faire une simple copie d'un diable occidental.

### 8.6. Esprits non hostiles

Prévoir également des âmes qui :
- Demandent de retrouver un objet.
- Indiquent un passage secret.
- Répètent un souvenir.
- Guident le joueur vers un lieu.
- Récompensent une action de compassion.

Tous les personnages et ennemis doivent pouvoir être désactivés avec le module événementiel.

## 9. Objets exclusifs

### 9.1. Lanterne de l'au-delà

Fonction :
- Révéler des esprits invisibles.
- Faire apparaître certains passages.
- Mettre en évidence les traces surnaturelles.

### 9.2. Sceau des esprits

Fonction :
- Immobiliser certains ennemis.
- Activer des mécanismes.
- Sceller une porte ou une faille.
- Résoudre des puzzles.

### 9.3. Cloche d'exorcisme

Fonction :
- Interrompre certaines capacités surnaturelles.
- Révéler les illusions.
- Attirer ou éloigner certains esprits.

### 9.4. Jade des âmes

Fonction :
- Servir de relique de quête.
- Offrir une protection contre certaines malédictions.
- Débloquer une récompense facultative.

### 9.5. Autres objets possibles

- Encens rituel.
- Pièce ancienne des Enfers.
- Fragment de miroir spirituel.
- Registre des âmes.
- Clé d'un sanctuaire.
- Fragment de sceau brisé.

Les objets doivent être compatibles avec l'inventaire existant. Ne pas introduire un nouveau système d'inventaire uniquement pour cet événement.

## 10. Quêtes et énigmes

Prévoir une chaîne de quêtes facultative.

Étapes recommandées :

1. Découvrir un sanctuaire abandonné.
2. Trouver le moyen d'ouvrir le passage vers le biome.
3. Rencontrer un personnage connaissant les rites de protection.
4. Récupérer plusieurs talismans.
5. Rallumer les lanternes spirituelles.
6. Explorer le biome et aider certaines âmes.
7. Restaurer les sceaux.
8. Affronter ou apaiser le gardien final.
9. Obtenir une récompense et refermer le passage.

Les énigmes peuvent inclure :
- Allumer des lanternes dans un ordre précis.
- Orienter des miroirs.
- Déplacer des blocs.
- Associer des symboles.
- Suivre des traces invisibles.
- Reconstituer un sceau.
- Utiliser un objet au bon endroit.
- Comprendre les souvenirs d'une âme.

Réutiliser les mécaniques existantes plutôt que de créer un système de puzzle séparé sans nécessité.

## 11. Récompenses

Récompenses possibles :
- Skin de personnage inspiré du folklore chinois.
- Skin de Jiangshi pour un personnage compatible, si cela reste cohérent.
- Apparence spéciale pour certaines armes.
- Variante visuelle de la lanterne.
- Accessoire cosmétique.
- Titre ou succès.
- Objet unique facultatif.
- Décoration pouvant être conservée après l'événement.

Les récompenses doivent être accessibles par le jeu, sans achat obligatoire, connexion quotidienne ou horaire imposé.

Le joueur doit conserver définitivement les skins et objets permanents qu'il a obtenus, même lorsque l'événement est désactivé dans une version ultérieure.

Ne pas supprimer les récompenses déjà acquises lors de la désactivation.

## 12. Ce qu'il faut éviter

### 12.1. Éléments visuels trop occidentaux

Éviter :
- Citrouilles sculptées.
- Jack-o'-lanterns.
- Sorcières à chapeau pointu.
- Balais et chaudrons de sorcière.
- Maisons hantées de style occidental.
- Châteaux gothiques.
- Cimetières à croix.
- Squelettes génériques comme motif principal.
- Toiles d'araignée omniprésentes.
- Palette orange et violet dominante.

Les araignées, les os ou les créatures fantastiques ne sont pas interdits en soi, mais ne doivent pas remplacer l'identité chinoise de l'événement.

### 12.2. Références culturelles incohérentes

Éviter de mélanger sans justification :
- Des costumes d'Halloween occidentaux.
- Des rites chinois.
- Des représentations japonaises ou coréennes utilisées comme si elles étaient interchangeables.
- Des architectures européennes médiévales.
- Des symboles religieux authentiques détournés au hasard.

Les références chinoises doivent former un ensemble visuel et narratif cohérent.

### 12.3. Traitement des esprits

Éviter de présenter tous les morts comme des monstres malveillants.

Certains peuvent être hostiles, d'autres perdus, protecteurs, trompeurs ou simplement incapables de trouver le repos.

### 12.4. Pratiques de conception à proscrire

Ne pas ajouter :
- De récompenses perdues définitivement si le joueur manque l'événement.
- De compte à rebours anxiogène.
- De notifications répétitives.
- De connexion quotidienne obligatoire.
- De mécanismes artificiels destinés à pousser le joueur à revenir.
- De pénalité pour les joueurs qui ne participent pas.

L'événement doit être un contenu facultatif, pas une obligation.

## 13. Architecture réutilisable pour les événements futurs

Le système doit distinguer trois couches.

### Couche A — Moteur événementiel

Gère :
- L'activation par configuration.
- L'enregistrement des contenus propres à l'événement.
- L'ajout et le retrait des ressources temporaires.
- Les règles d'accès au contenu.
- La compatibilité avec les sauvegardes.

### Couche B — Données de l'événement

Contient :
- Nom et description.
- Biome et cartes.
- Quêtes.
- Objets.
- Ennemis.
- Dialogues.
- Récompenses.
- Paramètres de gameplay.

### Couche C — Variantes visuelles

Gère :
- Skins de personnages.
- Variantes de sprites.
- Palettes de couleurs.
- Apparences d'armes.
- Variantes de tilesets.
- Effets visuels et sonores.
- Icônes et illustrations.

Le moteur doit être générique. Les données et les ressources propres à un événement ne doivent pas être codées en dur dans le moteur central.

### 13.1. Réutilisation des skins

Un même personnage peut avoir :
- Son apparence normale.
- Un skin « Nuit des âmes errantes ».
- Un skin de Nouvel An chinois.
- Un skin de Fête de la mi-automne.

Les skins temporaires doivent être appliqués sans modifier les données permanentes.

Lorsqu'un événement est désactivé, retirer uniquement la substitution temporaire et restaurer l'apparence que le joueur avait choisie.

Si un skin événementiel est débloqué de façon permanente, il doit rester disponible dans la collection du joueur.

### 13.2. Événements futurs

Le système doit pouvoir accueillir, par exemple :
- Nouvel An chinois.
- Fête de la mi-automne.
- Festival des lanternes.
- Un événement lié à Chang'e et au Lapin de Jade.
- Un événement consacré à Fusang et aux corbeaux solaires.

Ces événements doivent pouvoir réutiliser le moteur commun sans réécriture générale.

### 13.3. Réactivation

La réactivation d'un événement dans une nouvelle version doit :
- Restaurer son contenu.
- Préserver les récompenses permanentes.
- Éviter les duplications d'objets.
- Gérer explicitement la progression des quêtes.
- Permettre de rejouer les activités qui doivent l'être.
- Ne pas écraser les skins permanents sélectionnés.

La réactivation doit dépendre de la configuration intégrée au nouveau commit.

## 14. Gestion des sauvegardes

Examiner le système actuel avant d'effectuer des modifications.

Si le jeu utilise `localStorage`, réutiliser ce mécanisme. S'il utilise un autre système, le conserver.

Distinguer :
- Progression générale.
- Progression de l'événement.
- Récompenses permanentes.
- Skins possédés.
- Skin actuellement équipé.

La désactivation ne doit jamais supprimer la sauvegarde générale.

Si une ancienne sauvegarde référence le biome alors que l'événement est désactivé, prévoir un comportement sûr : redirection vers un lieu valide, accès suspendu ou autre solution adaptée au moteur.

Ne pas effacer les objets ou les récompenses permanentes déjà acquis.

## 15. Structure des ressources

Proposer une organisation compatible avec le dépôt existant. À titre indicatif :

```text
assets/
  events/
    wandering_souls/
      tilesets/
      sprites/
      characters/
      enemies/
      items/
      effects/
      audio/
      ui/
```

Ne pas déplacer ou dupliquer les ressources partagées sans nécessité.

Le biome doit utiliser des ressources événementielles séparées des ressources permanentes, tout en pouvant réutiliser les sprites, animations et effets communs.

La désactivation doit se faire par configuration, pas par suppression de fichiers.

## 16. Tests obligatoires

Vérifier les cas suivants :

1. Événement désactivé : le jeu fonctionne comme avant.
2. Événement activé : le point d'accès et le biome sont disponibles.
3. Les collisions et interactions du biome fonctionnent correctement.
4. Les objets et ennemis événementiels se comportent correctement.
5. Les quêtes peuvent être commencées, terminées et sauvegardées.
6. Les variantes visuelles sont appliquées correctement.
7. Les skins temporaires sont retirés proprement après désactivation.
8. Les skins permanents sont conservés.
9. Les sauvegardes existantes restent compatibles.
10. La désactivation ne supprime aucun objet permanent.
11. Le jeu fonctionne hors ligne.
12. Les ressources partagées restent accessibles.
13. Un futur événement peut utiliser le moteur commun sans dupliquer sa logique.

## 17. Plan de développement

Procéder dans cet ordre :

1. Inspecter le dépôt et résumer l'architecture existante.
2. Identifier les systèmes réutilisables.
3. Présenter un plan d'implémentation concis.
4. Créer le mécanisme d'activation par configuration.
5. Ajouter le support générique des événements.
6. Ajouter le biome facultatif.
7. Ajouter progressivement les éléments de décor.
8. Intégrer les objets, ennemis et mécaniques.
9. Ajouter les quêtes et les récompenses.
10. Ajouter les variantes de skins.
11. Tester la désactivation et la compatibilité des sauvegardes.
12. Documenter la création d'un futur événement.

Ne pas essayer de créer tous les contenus en une seule modification massive si cela risque de rendre le projet instable. Privilégier des étapes testables et compatibles avec le code existant.

## 18. Livrables attendus

À la fin de l'implémentation, fournir :
- La liste des fichiers créés et modifiés.
- La configuration exacte qui active ou désactive l'événement.
- Le fonctionnement du biome facultatif.
- La liste des ennemis et objets effectivement implémentés.
- Les mécaniques terminées et celles restant à faire.
- Les tests exécutés et leurs résultats.
- La procédure pour ajouter un nouvel événement.
- Les limites ou compromis techniques.

Ne pas déclarer une fonctionnalité terminée si elle n'est qu'un placeholder visuel ou une donnée non reliée au gameplay.

**Priorité absolue :** créer un événement facultatif cohérent avec le folklore chinois, fonctionnel dans le jeu existant et conçu comme le premier module d'un système d'événements réutilisable, activé et désactivé par commit Git.