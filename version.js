export const SITE_SEMVER = {
  major: 3,
  minor: 19,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-21T16:05:49.010Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
