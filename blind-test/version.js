export const BLIND_TEST_SEMVER = {
  major: 1,
  minor: 0,
  patch: 0,
  prerelease: '',
};

export function getBlindTestVersion() {
  const { major, minor, patch, prerelease } = BLIND_TEST_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}