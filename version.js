export const SITE_SEMVER = {
  major: 3,
  minor: 30,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-23T13:08:29.380Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
