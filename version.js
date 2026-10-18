export const SITE_SEMVER = {
  major: 2,
  minor: 85,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-18T15:38:45.087Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
