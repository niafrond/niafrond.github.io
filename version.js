export const SITE_SEMVER = {
  major: 3,
  minor: 29,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-23T12:22:37.190Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
