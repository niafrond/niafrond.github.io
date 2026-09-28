export const SITE_SEMVER = {
  major: 2,
  minor: 42,
  patch: 0,
  prerelease: '',
  buildDate: '2026-09-28T22:43:52.783Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
