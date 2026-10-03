export const SITE_SEMVER = {
  major: 2,
  minor: 58,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-03T22:27:07.905Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
