export const MATCH3_SEMVER = {
    major: 1,
    minor: 95,
    patch: 0,
    prerelease: '',
    buildDate: '2026-04-20T10:39:29.541Z'
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}

export function getMatch3BuildDate(){
    return MATCH3_SEMVER.buildDate || '';
}
