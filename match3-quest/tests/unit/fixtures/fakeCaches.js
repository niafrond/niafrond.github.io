// Faux Cache Storage pour les tests du service worker (sw.js) et du pré-téléchargement (offlineCache.js).

export class FakeCache {
    constructor() { this.map = new Map(); }
    keyOf(req) { return typeof req === 'string' ? req : req.url; }
    async put(req, res) { this.map.set(this.keyOf(req), { body: Buffer.from(await res.arrayBuffer()), status: res.status, headers: [...res.headers] }); }
    async match(req, opts = {}) {
        const key = this.keyOf(req);
        let hit = this.map.get(key);
        if (!hit && opts.ignoreSearch) for (const [k, v] of this.map) if (k.split('?')[0] === key.split('?')[0]) { hit = v; break; }
        return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined;
    }
    async delete(req) { return this.map.delete(this.keyOf(req)); }
    text(key) { return this.map.has(key) ? this.map.get(key).body.toString() : undefined; }
}
export class FakeCaches {
    constructor() { this.stores = new Map(); }
    async open(name) { if (!this.stores.has(name)) this.stores.set(name, new FakeCache()); return this.stores.get(name); }
    async keys() { return [...this.stores.keys()]; }
    async delete(name) { return this.stores.delete(name); }
}
