# Pixel Art Generator — Spécifications

Application web de génération de pixel art via l'API pixel.lab (pixellab.ai).

## Configuration

La clé API est stockée dans `pixel-art/config.js`, ignoré par git (`.gitignore`).
Copier `config.example.js` en `config.js` et renseigner `PIXELLAB_API_KEY`.

## Paramètres de génération

- **Prompt** : texte libre décrivant l'image souhaitée
- **Prompt négatif** : ce à éviter (flou, anti-aliasing…)
- **Taille** : 32×32, 48×48, 64×64 (défaut), 128×128
- **Style** : Libre, Game Boy, SNES RPG, NES 8-bit, GBA Sprite, Isométrique (ajoutés au prompt)
- **Nombre d'images** : 1, 2 ou 4 (requêtes parallèles)

## API pixel.lab

- Endpoint : `POST https://api.pixellab.ai/v1/generate-image`
- Auth : `Authorization: Bearer <key>`
- Body : `{ prompt, negative_prompt?, width, height, image_size: { width, height } }`
- Réponse supportée : `image` (base64), `b64_json`, `url`, ou `data[0].b64_json` / `data[0].url`

## Rendu

- `image-rendering: pixelated` sur le `<img>` résultat pour garder l'aspect pixel art
- Historique de session (8 dernières images, clic pour revoir)
- Téléchargement et copie presse-papiers

## Journal de session

- 2026-10-10 : création initiale de l'app pixel art (index.html + config.js gitignored + config.example.js)
