export const SITE_SEMVER = {
  major: 1,
  minor: 152,
  patch: 1,
  prerelease: '',
  buildDate: '2026-04-28T20:27:53.127Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
