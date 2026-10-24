export const SITE_SEMVER = {
  major: 2,
  minor: 130,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-24T14:25:33.162Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
