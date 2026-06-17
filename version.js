export const SITE_SEMVER = {
  major: 1,
  minor: 231,
  patch: 0,
  prerelease: '',
  buildDate: '2026-06-17T21:35:18.895Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
