export const SITE_SEMVER = {
  major: 2,
  minor: 1,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-21T12:21:57.845Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
