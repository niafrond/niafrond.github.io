export const SITE_SEMVER = {
  major: 2,
  minor: 219,
  patch: 4,
  prerelease: '',
  buildDate: '2026-11-09T18:19:01.259Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
