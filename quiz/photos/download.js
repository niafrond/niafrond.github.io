#!/usr/bin/env node
/**
 * download.js — Télécharge les photos du quiz depuis Wikimedia Commons
 *
 * Usage :
 *   node quiz/photos/download.js
 *
 * Les images sont enregistrées dans le même dossier que ce script
 * sous le nom NNN.jpg (ex : 001.jpg, 052.jpg).
 * Les images déjà présentes sont ignorées (pas de re-téléchargement).
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DIR   = __dirname;
const INDEX = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, {
      headers: { 'User-Agent': 'QuizPhotoDownloader/1.0 (niafrond.github.io)' },
      timeout: 20000,
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', err => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(err); });
    req.on('timeout', ()  => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const entries = Object.entries(INDEX);
  let ok = 0, skip = 0, fail = 0;

  for (const [num, meta] of entries) {
    const dest = path.join(DIR, `${num}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`[skip] ${num}.jpg — déjà présent`);
      skip++;
      continue;
    }
    process.stdout.write(`[↓]   ${num}.jpg  ${meta.titre} … `);
    try {
      await download(meta.url_source, dest);
      console.log('OK');
      ok++;
    } catch (err) {
      console.log(`ERREUR (${err.message})`);
      fail++;
    }
  }

  console.log(`\nTerminé : ${ok} téléchargé(s), ${skip} ignoré(s), ${fail} erreur(s).`);
  if (fail > 0) process.exit(1);
})();
