export const MATCH3_SEMVER = {
    major: 1,
    minor: 35,
    patch: 1,
    prerelease: ''
};

export function getMatch3Version(){
    const { major, minor, patch, prerelease } = MATCH3_SEMVER;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}
