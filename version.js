export const SITE_SEMVER = {
  major: 1,
  minor: 138,
  patch: 1,
  prerelease: '',
  buildDate: '2026-04-24T20:13:39.141Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
