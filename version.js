export const SITE_SEMVER = {
  major: 2,
  minor: 210,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-08T15:51:58.157Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
