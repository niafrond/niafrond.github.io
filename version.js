export const SITE_SEMVER = {
  major: 2,
  minor: 41,
  patch: 0,
  prerelease: '',
  buildDate: '2026-09-28T21:32:22.532Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
