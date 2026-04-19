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
const target = path.resolve(process.cwd(), 'match3-quest/version.js');

const buildDate = new Date().toISOString();

const nextContent = `export const MATCH3_SEMVER = {
    major: ${Number(major)},
    minor: ${Number(minor)},
    patch: ${Number(patch)},
    prerelease: '${prerelease}',
    buildDate: '${buildDate}'
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = \`${'${major}'}.${'${minor}'}.${'${patch}'}\`;
    return prerelease ? \`${'${base}'}-${'${prerelease}'}\` : base;
}

export function getMatch3BuildDate(){
    return MATCH3_SEMVER.buildDate || '';
}
`;

const swTarget = path.resolve(process.cwd(), 'times-up/sw.js');
const swContent = fs.readFileSync(swTarget, 'utf8');
const newSwContent = swContent.replace(
  /const CACHE = 'timesup-v[^']+';/,
  `const CACHE = 'timesup-v${rawVersion}';`
);
fs.writeFileSync(target, nextContent, 'utf8');
console.log(`Updated ${target} -> ${rawVersion}`);
fs.writeFileSync(swTarget, newSwContent, 'utf8');
console.log(`Updated ${swTarget} -> CACHE timesup-v${rawVersion}`);

