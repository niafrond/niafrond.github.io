export const SITE_SEMVER = {
  major: 1,
  minor: 126,
  patch: 0,
  prerelease: '',
  buildDate: '2026-04-22T08:00:04.164Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
