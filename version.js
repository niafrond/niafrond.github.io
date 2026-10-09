export const SITE_SEMVER = {
  major: 2,
  minor: 62,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-09T22:11:33.542Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
