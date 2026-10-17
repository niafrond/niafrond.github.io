export const SITE_SEMVER = {
  major: 2,
  minor: 77,
  patch: 2,
  prerelease: '',
  buildDate: '2026-10-17T16:50:09.609Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
