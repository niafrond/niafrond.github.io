export const SITE_SEMVER = {
  major: 2,
  minor: 219,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-09T15:56:00.407Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
