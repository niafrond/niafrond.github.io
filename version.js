export const SITE_SEMVER = {
  major: 2,
  minor: 26,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-31T02:47:59.670Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
