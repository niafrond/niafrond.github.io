export const SITE_SEMVER = {
  major: 1,
  minor: 251,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-10T21:54:01.831Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
