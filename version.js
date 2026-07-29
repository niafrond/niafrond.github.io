export const SITE_SEMVER = {
  major: 2,
  minor: 20,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-29T16:23:34.303Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
