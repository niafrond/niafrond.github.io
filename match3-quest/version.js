export const MATCH3_SEMVER = {
    major: 1,
    minor: 16,
    patch: 0,
    prerelease: ''
};

export function formatSemver(semver){
    const { major, minor, patch, prerelease } = semver;
    const base = `${major}.${minor}.${patch}`;
    return prerelease ? `${base}-${prerelease}` : base;
}

export function getMatch3Version(){
    return formatSemver(MATCH3_SEMVER);
}
