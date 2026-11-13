export const SITE_SEMVER = {
  major: 2,
  minor: 239,
  patch: 1,
  prerelease: '',
  buildDate: '2026-11-13T16:00:01.165Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
