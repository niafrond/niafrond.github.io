export const SITE_SEMVER = {
  major: 2,
  minor: 167,
  patch: 1,
  prerelease: '',
  buildDate: '2026-10-31T23:47:59.947Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
