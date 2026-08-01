export const SITE_SEMVER = {
  major: 2,
  minor: 26,
  patch: 1,
  prerelease: '',
  buildDate: '2026-08-01T00:14:44.888Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
