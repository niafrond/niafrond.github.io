export const SITE_SEMVER = {
  major: 1,
  minor: 143,
  patch: 1,
  prerelease: '',
  buildDate: '2026-04-27T16:47:41.761Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
