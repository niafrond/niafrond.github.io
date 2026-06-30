export const SITE_SEMVER = {
  major: 1,
  minor: 240,
  patch: 0,
  prerelease: '',
  buildDate: '2026-06-30T20:30:38.686Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
