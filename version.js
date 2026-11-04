export const SITE_SEMVER = {
  major: 2,
  minor: 185,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-04T18:07:21.801Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
