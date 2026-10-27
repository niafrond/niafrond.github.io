export const SITE_SEMVER = {
  major: 2,
  minor: 153,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-27T13:10:11.505Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
