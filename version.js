export const SITE_SEMVER = {
  major: 2,
  minor: 27,
  patch: 0,
  prerelease: '',
  buildDate: '2026-08-01T21:38:37.385Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
