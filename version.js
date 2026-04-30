export const SITE_SEMVER = {
  major: 1,
  minor: 162,
  patch: 0,
  prerelease: '',
  buildDate: '2026-04-30T14:45:39.958Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
