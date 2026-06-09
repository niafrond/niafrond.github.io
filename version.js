export const SITE_SEMVER = {
  major: 1,
  minor: 218,
  patch: 9,
  prerelease: '',
  buildDate: '2026-06-09T16:57:11.553Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
