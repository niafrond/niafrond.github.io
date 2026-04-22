import fs from 'node:fs';
import path from 'node:path';

const rawVersion = process.argv[2];

if(!rawVersion){
    console.error('Missing semantic version argument.');
    process.exit(1);
}

const match = rawVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
if(!match){
    console.error(`Invalid semantic version: ${rawVersion}`);
    process.exit(1);
}

const [, major, minor, patch, prerelease = ''] = match;
const buildDate = new Date().toISOString();

// ── Root version.js ──
const versionTarget = path.resolve(process.cwd(), 'version.js');
const nextContent = `export const SITE_SEMVER = {
  major: ${Number(major)},
  minor: ${Number(minor)},
  patch: ${Number(patch)},
  prerelease: '${prerelease}',
  buildDate: '${buildDate}',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = \`${'${major}'}.${'${minor}'}.${'${patch}'}\`;
  return prerelease ? \`${'${base}'}-${'${prerelease}'}\` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
`;
fs.writeFileSync(versionTarget, nextContent, 'utf8');
console.log(`Updated ${versionTarget} -> ${rawVersion}`);

// ── times-up/sw.js ──
const timesUpSwTarget = path.resolve(process.cwd(), 'times-up/sw.js');
const timesUpSwContent = fs.readFileSync(timesUpSwTarget, 'utf8');
const newTimesUpSwContent = timesUpSwContent.replace(
  /const CACHE = 'timesup-v[^']+';/,
  `const CACHE = 'timesup-v${rawVersion}';`
);
fs.writeFileSync(timesUpSwTarget, newTimesUpSwContent, 'utf8');
console.log(`Updated ${timesUpSwTarget} -> CACHE timesup-v${rawVersion}`);

// ── flash-guess/sw.js ──
const flashGuessSwTarget = path.resolve(process.cwd(), 'flash-guess/sw.js');
const flashGuessSwContent = fs.readFileSync(flashGuessSwTarget, 'utf8');
const newFlashGuessSwContent = flashGuessSwContent.replace(
  /const CACHE = 'flashguess-v[^']+';/,
  `const CACHE = 'flashguess-v${rawVersion}';`
);
fs.writeFileSync(flashGuessSwTarget, newFlashGuessSwContent, 'utf8');
console.log(`Updated ${flashGuessSwTarget} -> CACHE flashguess-v${rawVersion}`);

