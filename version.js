export const SITE_SEMVER = {
  major: 1,
  minor: 177,
  patch: 5,
  prerelease: '',
  buildDate: '2026-05-05T10:21:49.304Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
