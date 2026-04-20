export const MATCH3_SEMVER = {
    major: 1,
    minor: 113,
    patch: 0,
    prerelease: '',
    buildDate: '2026-04-20T20:06:10.405Z'
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}

export function getMatch3BuildDate(){
    return MATCH3_SEMVER.buildDate || '';
}
