export const SITE_SEMVER = {
  major: 1,
  minor: 218,
  patch: 2,
  prerelease: '',
  buildDate: '2026-06-02T19:55:55.726Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
