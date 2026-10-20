export const SITE_SEMVER = {
  major: 2,
  minor: 103,
  patch: 1,
  prerelease: '',
  buildDate: '2026-10-20T15:07:02.587Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
