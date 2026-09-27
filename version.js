export const SITE_SEMVER = {
  major: 2,
  minor: 36,
  patch: 1,
  prerelease: '',
  buildDate: '2026-09-27T22:07:19.127Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
