export const SITE_SEMVER = {
  major: 2,
  minor: 67,
  patch: 0,
  prerelease: '',
  buildDate: '2026-10-11T14:51:32.705Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
