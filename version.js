export const SITE_SEMVER = {
  major: 2,
  minor: 50,
  patch: 0,
  prerelease: '',
  buildDate: '2026-09-29T23:04:48.481Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
