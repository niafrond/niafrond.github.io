export const SITE_SEMVER = {
  major: 1,
  minor: 246,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-06T16:46:24.588Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
