export const SITE_SEMVER = {
  major: 1,
  minor: 263,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-19T15:08:08.280Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
