export const SITE_SEMVER = {
  major: 1,
  minor: 197,
  patch: 0,
  prerelease: '',
  buildDate: '2026-05-15T22:58:57.215Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
