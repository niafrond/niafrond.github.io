export const SITE_SEMVER = {
  major: 1,
  minor: 141,
  patch: 0,
  prerelease: '',
  buildDate: '2026-04-27T11:33:24.047Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
