export const SITE_SEMVER = {
  major: 1,
  minor: 219,
  patch: 1,
  prerelease: '',
  buildDate: '2026-06-10T12:05:05.136Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
