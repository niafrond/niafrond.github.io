export const SITE_SEMVER = {
  major: 2,
  minor: 91,
  patch: 1,
  prerelease: '',
  buildDate: '2026-10-18T22:55:08.648Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
