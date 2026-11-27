export const SITE_SEMVER = {
  major: 3,
  minor: 48,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-27T17:48:34.653Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
