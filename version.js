export const SITE_SEMVER = {
  major: 1,
  minor: 215,
  patch: 0,
  prerelease: '',
  buildDate: '2026-06-01T07:30:57.639Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
