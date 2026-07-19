export const SITE_SEMVER = {
  major: 2,
  minor: 0,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-19T16:57:09.953Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
