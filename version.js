export const SITE_SEMVER = {
  major: 1,
  minor: 148,
  patch: 0,
  prerelease: '',
  buildDate: '2026-04-28T09:03:53.996Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
