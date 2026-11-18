export const SITE_SEMVER = {
  major: 3,
  minor: 4,
  patch: 1,
  prerelease: '',
  buildDate: '2026-11-18T18:07:31.831Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
