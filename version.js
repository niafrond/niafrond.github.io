export const SITE_SEMVER = {
  major: 2,
  minor: 218,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-09T13:50:05.571Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
