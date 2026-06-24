export const SITE_SEMVER = {
  major: 1,
  minor: 234,
  patch: 0,
  prerelease: '',
  buildDate: '2026-06-24T11:14:14.585Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
