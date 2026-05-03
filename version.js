export const SITE_SEMVER = {
  major: 1,
  minor: 176,
  patch: 1,
  prerelease: '',
  buildDate: '2026-05-03T20:59:18.430Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
