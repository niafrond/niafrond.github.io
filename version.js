export const SITE_SEMVER = {
  major: 1,
  minor: 255,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-12T17:16:08.330Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
