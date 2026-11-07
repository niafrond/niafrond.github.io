/* count.js : mesure d'audience sans cookie, sans stockage local, sans identifiant, sans adresse IP ni user-agent conservés.
 * On incrémente seulement des compteurs par jour dans Firestore via l'API REST : page vue ; à l'arrivée sur le site (visite) provenance
 * (nom de domaine ou « direct »). Rien d'autre : ni appareil, ni pays, ni langue, ni identifiant.
 * Respecte Do Not Track et Global Privacy Control ; ignore robots, navigateurs pilotés et localhost.
 * Usage : <script async src="https://stats.fontaine.one/count.js"></script> */
(function () {
    'use strict';
    var P = 'fontaine-stats-one', K = 'AIzaSyAoHiXfQqqVykyK7ESnfYAShnNE9mbWydk';
    try {
        var n = navigator, l = location;
        if (!/^https?:$/.test(l.protocol) || /^(localhost$|127\.|\[::1\])/.test(l.hostname)) return;
        if (n.doNotTrack === '1' || window.doNotTrack === '1' || n.globalPrivacyControl) return;
        if (n.webdriver || /bot|crawl|spider|headless|lighthouse|preview/i.test(n.userAgent)) return;

        var host = l.hostname.replace(/^www\./, '');
        var path = (l.pathname.replace(/index\.html$/, '') || '/').slice(0, 200);   // jamais la query ni le #hash
        var now = new Date(), y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, d = now.getUTCDate();
        var day = y * 10000 + m * 100 + d;
        var expireAt = new Date(Date.UTC(y, m - 1, d) + 400 * 864e5).toISOString().replace('.000', '');

        var hash = function (s) {   // cyrb53 : identifiant court et stable du couple site + page
            var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, c;
            for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
            h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
            return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
        };
        var doc = function (coll, id, fields) {
            var f = { day: { integerValue: String(day) }, host: { stringValue: host }, expireAt: { timestampValue: expireAt } };
            var mask = ['day', 'host', 'expireAt'];
            Object.keys(fields).forEach(function (k) { f[k] = { stringValue: fields[k] }; mask.push(k); });
            return {
                update: { name: 'projects/' + P + '/databases/(default)/documents/' + coll + '/' + day + '_' + host + '_' + id, fields: f },
                updateMask: { fieldPaths: mask },
                updateTransforms: [{ fieldPath: 'views', increment: { integerValue: '1' } }]
            };
        };

        var writes = [doc('views', hash(host + path), { path: path })];
        var ref = '';
        try { ref = new URL(document.referrer).hostname.replace(/^www\./, '').slice(0, 100); } catch (e) { /* pas de provenance */ }
        if (ref !== host) {   // arrivée sur le site (visite) et non navigation interne : provenance
            writes.push(doc('refs', hash(ref || '(direct)'), { ref: ref || '(direct)' }));
        }

        fetch('https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents:commit?key=' + K, {
            method: 'POST', keepalive: true, credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes: writes })
        }).catch(function () { /* la mesure ne doit jamais gêner la page */ });
    } catch (e) { /* idem */ }
})();
