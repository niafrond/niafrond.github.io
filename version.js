export const SITE_SEMVER = {
  major: 1,
  minor: 179,
  patch: 0,
  prerelease: '',
  buildDate: '2026-05-05T23:03:00.734Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
