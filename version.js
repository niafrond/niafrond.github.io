export const SITE_SEMVER = {
  major: 1,
  minor: 164,
  patch: 0,
  prerelease: '',
  buildDate: '2026-05-01T16:48:40.623Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
