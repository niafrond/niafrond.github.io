# DJ Mix PWA et Android Auto - Implémentation

## Problème résolu
Le mode PWA de DJ Mix ne permettait pas l'installation de l'application et n'était pas reconnu comme une vraie application musicale compatible avec Android Auto.

## Changements effectués

### 1. Service Worker (sw.js)
- **Nouveau fichier** : `/dj-mix/sw.js`
- Cache tous les fichiers essentiels de l'application
- Gère les mises à jour automatiques
- Exclut les requêtes cross-origin et API
- Sécurité : validation stricte des URLs pour éviter les attaques

### 2. Module PWA (pwa.js)
- **Nouveau fichier** : `/dj-mix/pwa.js`
- Gère l'événement `beforeinstallprompt` pour permettre l'installation
- Bouton d'installation PWA dans les paramètres
- Gestion du plein écran
- Rechargement intelligent après mise à jour du service worker

### 3. Manifest.json amélioré
**Catégories ajoutées** :
- `"categories": ["music", "entertainment"]` - identifie l'app comme musicale
- `"display_override": ["window-controls-overlay"]` - meilleure intégration Android Auto
- `"prefer_related_applications": false` - favorise la PWA

**Icônes multiples** :
- 192x192 pour Android
- 512x512 maskable pour adaptive icons

**Shortcuts Android Auto** (3 raccourcis) :
1. **Mix Auto** (`?automix=1`) - Lance le mixage automatique
2. **Playlists** (`?tab=playlists`) - Accède aux playlists
3. **Queue** (`?tab=queue`) - Affiche la file d'attente

### 4. Gestion des paramètres URL
Fonction `handleShortcutParameters()` dans `main.js` :
- Détecte `?automix=1` et lance automatiquement le mix
- Détecte `?tab=X` et ouvre l'onglet correspondant
- Support complet pour Android Auto

### 5. Media Session API (déjà présent)
L'application utilisait déjà correctement :
- `navigator.mediaSession.metadata` avec titre, artiste, album, artwork
- Handlers pour play, pause, stop, seek, nexttrack
- `setPositionState()` pour la barre de progression
- Parfait pour les contrôles Android Auto et notifications système

### 6. Intégration dans main.js
- Import de `initServiceWorker()` et `installPwa()`
- Initialisation au démarrage
- Bouton d'installation dans la section Config

### 7. Interface utilisateur
**Section Config mise à jour** :
```html
<div class="config-block">
  <div class="config-label">
    <span>Application PWA</span>
  </div>
  <button id="btn-install-pwa" class="connect-btn connect-btn--secondary" type="button" hidden>
    📥 Installer l'application
  </button>
  <div class="setup-subtitle">
    Installez DJ Mix comme application pour Android Auto et une meilleure expérience.
  </div>
</div>
```

## Android Auto - Comment ça marche

### Reconnaissance automatique
Avec les changements, Android Auto reconnaît DJ Mix comme application musicale grâce à :
1. **Catégorie "music"** dans le manifest
2. **Media Session API** active
3. **Service Worker** installé (PWA complète)

### Écrans supplémentaires
Les écrans Android Auto sont générés automatiquement :
- **Écran principal** : lecture en cours avec contrôles
- **Écran queue** : file d'attente accessible via shortcut
- **Écran playlists** : accès aux playlists via shortcut

### Shortcuts dans Android Auto
Les 3 shortcuts apparaissent dans le menu Android Auto :
- Icône ▶️ pour lancer le Mix Auto
- Icône 📋 pour les Playlists
- Icône 🎵 pour la Queue

## Installation

### Sur mobile/tablette
1. Ouvrir DJ Mix dans Chrome/Edge
2. Bannière "Ajouter à l'écran d'accueil" apparaît automatiquement
3. OU aller dans Config → cliquer sur "📥 Installer l'application"

### Sur Android Auto
1. Installer l'app via le mobile
2. Android Auto détecte automatiquement l'app musicale
3. L'icône DJ Mix 🎚️ apparaît dans la section Musique
4. Les shortcuts sont accessibles via le menu

## Persistance et Cache
- `navigator.storage.persist()` demandé automatiquement
- Cache audio séparé : `dj-mix:audio-cache:v1`
- Service worker cache : `djmix-v1.0.0`
- Fonctionne hors ligne une fois installé

## Sécurité
- ✅ Validation stricte des URLs dans le service worker
- ✅ Pas d'interception des requêtes cross-origin
- ✅ CodeQL : 0 alerte de sécurité

## Notes techniques
- Compatible avec Wake Lock API (écran allumé pendant lecture)
- Support iOS avec `apple-mobile-web-app-capable`
- Gestion intelligente de la mémoire (déjà présent)
- Rechargement automatique lors des mises à jour hors lecture
