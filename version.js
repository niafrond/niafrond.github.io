export const SITE_SEMVER = {
  major: 1,
  minor: 155,
  patch: 3,
  prerelease: '',
  buildDate: '2026-04-28T22:46:59.843Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
