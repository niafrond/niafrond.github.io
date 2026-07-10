require('dotenv').config();
const express = require('express');
const path = require('path');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3400;
const PLEX_SERVER_URL = (process.env.PLEX_SERVER_URL || 'http://127.0.0.1:32400').replace(/\/$/, '');
const PLEX_TOKEN = process.env.PLEX_TOKEN || '';
const CLIENT_IDENTIFIER = 'niafrond-plex-mobile-webapp';
const PLEX_ORIGIN = new URL(PLEX_SERVER_URL).origin;

if (!PLEX_TOKEN || PLEX_TOKEN === 'your_plex_token_here') {
    console.warn('⚠️  PLEX_TOKEN manquant/non configuré dans .env — les appels vers Plex échoueront.');
}

app.use(express.static(path.join(__dirname, 'public')));

// Les playlists HLS renvoyées par Plex contiennent des URLs (relatives ou
// absolues) vers le serveur Plex lui-même. On les réécrit pour qu'elles
// repassent par notre proxy, qui réinjecte le token à chaque requête.
function rewritePlaylist(text) {
    return text
        .split('\n')
        .map((line) => {
            if (!line || line.startsWith('#')) return line;
            try {
                const abs = new URL(line, PLEX_SERVER_URL + '/');
                if (abs.origin === PLEX_ORIGIN) return '/api/plex' + abs.pathname + abs.search;
            } catch {
                // ligne non-URL (ne devrait pas arriver dans un m3u8), on la laisse telle quelle
            }
            return line;
        })
        .join('\n');
}

// Proxy générique vers le serveur Plex local : masque le token au client,
// évite les soucis de CORS, et relaie tel quel API JSON, images et flux HLS.
app.use('/api/plex', async (req, res) => {
    const targetUrl = new URL(PLEX_SERVER_URL + req.url);
    targetUrl.searchParams.set('X-Plex-Token', PLEX_TOKEN);

    try {
        const upstream = await fetch(targetUrl, {
            method: req.method,
            headers: {
                Accept: req.headers.accept || 'application/json',
                'X-Plex-Client-Identifier': CLIENT_IDENTIFIER,
                'X-Plex-Product': 'Plex Mobile Web',
                'X-Plex-Device': 'Web',
                'X-Plex-Platform': 'Chrome',
                ...(req.headers.range ? { Range: req.headers.range } : {})
            }
        });

        const contentType = upstream.headers.get('content-type') || '';
        res.status(upstream.status);

        if (contentType.includes('mpegurl') || targetUrl.pathname.endsWith('.m3u8')) {
            const text = await upstream.text();
            res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
            res.send(rewritePlaylist(text));
            return;
        }

        if (contentType) res.setHeader('Content-Type', contentType);
        for (const h of ['content-range', 'accept-ranges', 'content-length', 'cache-control']) {
            const v = upstream.headers.get(h);
            if (v) res.setHeader(h, v);
        }

        if (!upstream.body) return res.end();
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (err) {
        console.error('Erreur proxy Plex:', err.message);
        res.status(502).json({ error: `Impossible de joindre le serveur Plex: ${err.message}` });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const url = new URL(PLEX_SERVER_URL + '/identity');
        url.searchParams.set('X-Plex-Token', PLEX_TOKEN);
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        res.json({ ok: r.ok, status: r.status });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`plex-mobile lancé sur http://0.0.0.0:${PORT}`);
    console.log(`Depuis ton téléphone (même Wi-Fi) : http://<IP-de-ce-PC>:${PORT}`);
});
