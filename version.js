export const SITE_SEMVER = {
  major: 1,
  minor: 254,
  patch: 0,
  prerelease: '',
  buildDate: '2026-07-12T14:28:33.767Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
