export const SITE_SEMVER = {
  major: 1,
  minor: 155,
  patch: 2,
  prerelease: '',
  buildDate: '2026-04-28T22:46:05.452Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
