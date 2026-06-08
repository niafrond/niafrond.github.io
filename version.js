export const SITE_SEMVER = {
  major: 1,
  minor: 218,
  patch: 7,
  prerelease: '',
  buildDate: '2026-06-08T11:48:19.095Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
