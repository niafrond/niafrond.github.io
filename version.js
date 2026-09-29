export const SITE_SEMVER = {
  major: 2,
  minor: 43,
  patch: 0,
  prerelease: '',
  buildDate: '2026-09-29T08:38:50.309Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
