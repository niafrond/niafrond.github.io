export const SITE_SEMVER = {
  major: 2,
  minor: 73,
  patch: 1,
  prerelease: '',
  buildDate: '2026-10-16T14:41:34.856Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
