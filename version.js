export const SITE_SEMVER = {
  major: 1,
  minor: 169,
  patch: 2,
  prerelease: '',
  buildDate: '2026-05-02T17:35:18.511Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
