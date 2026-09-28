export const SITE_SEMVER = {
  major: 2,
  minor: 37,
  patch: 0,
  prerelease: '',
  buildDate: '2026-09-27T22:32:28.022Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
