export const SITE_SEMVER = {
  major: 1,
  minor: 233,
  patch: 1,
  prerelease: '',
  buildDate: '2026-06-23T18:34:07.877Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
