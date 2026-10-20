export const SITE_SEMVER = {
  major: 2,
  minor: 104,
  patch: 1,
  prerelease: '',
  buildDate: '2026-10-20T17:29:48.980Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
