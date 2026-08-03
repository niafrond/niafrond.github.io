export const SITE_SEMVER = {
  major: 2,
  minor: 28,
  patch: 0,
  prerelease: '',
  buildDate: '2026-08-03T00:25:02.538Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
