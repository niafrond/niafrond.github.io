export const SITE_SEMVER = {
  major: 1,
  minor: 218,
  patch: 4,
  prerelease: '',
  buildDate: '2026-06-03T20:08:11.721Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
