export const MATCH3_SEMVER = {
    major: 1,
    minor: 68,
    patch: 1,
    prerelease: '',
    buildDate: ''
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}

export function getMatch3BuildDate(){
    return MATCH3_SEMVER.buildDate || '';
}
