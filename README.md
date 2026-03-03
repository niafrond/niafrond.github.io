# niafrond.github.io

Ce dépôt contient un petit générateur de recettes (HTML/JS) utilisé
pour formater des textes ou extraire des recettes depuis des pages web.

## Extraction depuis une URL

Dans l'onglet « Depuis une URL », le script récupère la page et tente :

1. d'extraire un objet structuré JSON‑LD de type `Recipe` (la méthode `findRecipeJsonLd`).
2. si rien n'est trouvé, d'appliquer un parseur de texte générique.

Pour certains sites on peut définir des parseurs spécialisés. Le tableau
`urlParsers` en JavaScript associe une expression régulière de nom de domaine
à une fonction qui prend le document HTML et renvoie l'objet recette. Un
exemple pour `veganpratique.com` est déjà compris.

Cela remplace l'approche précédente où le seul parseur client était celui
pour VeganPratique et il fallait renommer les URL pour les faire fonctionner.