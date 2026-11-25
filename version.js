export const SITE_SEMVER = {
  major: 3,
  minor: 42,
  patch: 0,
  prerelease: '',
  buildDate: '2026-11-25T23:06:16.153Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
