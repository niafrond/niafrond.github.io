export const SITE_SEMVER = {
  major: 1,
  minor: 177,
  patch: 6,
  prerelease: '',
  buildDate: '2026-05-05T22:39:50.710Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
