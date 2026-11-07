/* count.js : mesure d'audience sans cookie, sans stockage local, sans identifiant, sans adresse IP ni user-agent conservés.
 * On incrémente seulement des compteurs par jour dans Firestore via l'API REST : page vue ; à l'arrivée sur le site (visite) provenance
 * (nom de domaine ou « direct »), navigateur, système, langue, fuseau horaire (sert à estimer le pays, sans IP), largeur d'écran, temps de réponse
 * et code HTTP de la page, plus la minute et l'heure (UTC). Chaque valeur est un compteur séparé : jamais de combinaison, jamais d'identifiant.
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
        var dim = function (name, value) { if (value) writes.push(doc('dims', hash(name + value), { dim: name, value: String(value) })); };
        var two = function (x) { return ('0' + x).slice(-2); };
        dim('minute', two(now.getUTCHours()) + two(now.getUTCMinutes()));   // chaque page vue : pics de requêtes par minute (UTC)
        if (ref !== host) {   // arrivée sur le site (visite) et non navigation interne
            writes.push(doc('refs', hash(ref || '(direct)'), { ref: ref || '(direct)' }));
            var ua = n.userAgent;
            dim('hour', two(now.getUTCHours()));
            dim('browser', /Edg\//.test(ua) ? 'edge' : /OPR\/|Opera/.test(ua) ? 'opera' : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox|FxiOS/.test(ua) ? 'firefox' : /Chrome|CriOS/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'autre');
            dim('os', /Android/.test(ua) ? 'android' : /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Windows/.test(ua) ? 'windows' : /Mac OS X|Macintosh/.test(ua) ? 'macos' : /CrOS/.test(ua) ? 'chromeos' : /Linux|X11/.test(ua) ? 'linux' : 'autre');
            var lang = (n.language || '').slice(0, 2).toLowerCase();
            if (/^[a-z]{2}$/.test(lang)) dim('lang', lang);
            var tz = '';
            try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* pas de fuseau */ }
            if (tz.length <= 40 && /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(tz)) dim('tz', tz);
            var w = window.innerWidth || 0;
            if (w) dim('width', w < 480 ? 'xs' : w < 768 ? 'sm' : w < 1200 ? 'md' : w < 1920 ? 'lg' : 'xl');
            try {
                var nav = performance.getEntriesByType('navigation')[0];
                if (nav && nav.responseStart > 0) {
                    var t = nav.responseStart - nav.requestStart;
                    dim('ttfb', t < 100 ? 'lt100' : t < 300 ? 'lt300' : t < 1000 ? 'lt1000' : 'gte1000');
                    if (nav.responseStatus) dim('status', nav.responseStatus);
                }
            } catch (e) { /* API de performance absente */ }
        }

        fetch('https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents:commit?key=' + K, {
            method: 'POST', keepalive: true, credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes: writes })
        }).catch(function () { /* la mesure ne doit jamais gêner la page */ });
    } catch (e) { /* idem */ }
})();
