export const MATCH3_SEMVER = {
    major: 1,
    minor: 34,
    patch: 0,
    prerelease: ''
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}
