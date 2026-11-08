export const SITE_SEMVER = {
  major: 2,
  minor: 207,
  patch: 1,
  prerelease: '',
  buildDate: '2026-11-08T13:18:23.476Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
