export const SITE_SEMVER = {
  major: 1,
  minor: 207,
  patch: 1,
  prerelease: '',
  buildDate: '2026-05-25T00:27:41.658Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
