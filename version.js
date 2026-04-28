export const SITE_SEMVER = {
  major: 1,
  minor: 152,
  patch: 2,
  prerelease: '',
  buildDate: '2026-04-28T20:57:45.658Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
