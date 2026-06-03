export const SITE_SEMVER = {
  major: 1,
  minor: 218,
  patch: 5,
  prerelease: '',
  buildDate: '2026-06-03T20:13:59.495Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
