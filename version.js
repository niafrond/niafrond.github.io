export const SITE_SEMVER = {
  major: 1,
  minor: 202,
  patch: 1,
  prerelease: '',
  buildDate: '2026-05-20T12:13:12.425Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
