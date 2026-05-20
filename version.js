export const SITE_SEMVER = {
  major: 1,
  minor: 203,
  patch: 0,
  prerelease: '',
  buildDate: '2026-05-20T14:07:59.031Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
