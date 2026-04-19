export const MATCH3_SEMVER = {
    major: 1,
    minor: 87,
    patch: 2,
    prerelease: '',
    buildDate: '2026-04-19T19:47:12.904Z'
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}

export function getMatch3BuildDate(){
    return MATCH3_SEMVER.buildDate || '';
}
