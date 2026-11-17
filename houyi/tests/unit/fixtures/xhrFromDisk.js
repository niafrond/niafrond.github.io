// Les catalogues (ennemis, sorts) sont normalement chargés par XMLHttpRequest synchrone : ce module les sert depuis le disque.
// À importer en premier dans un test (les imports s'évaluent dans l'ordre).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

globalThis.XMLHttpRequest = class {
    open(_method, url) { this.url = url; }
    send() {
        this.responseText = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', this.url.split('?')[0]), 'utf8');
        this.status = 200;
    }
};

