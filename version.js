export const SITE_SEMVER = {
  major: 2,
  minor: 92,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-18T23:49:03.766Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
