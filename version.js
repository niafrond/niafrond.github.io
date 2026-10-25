export const SITE_SEMVER = {
  major: 2,
  minor: 131,
  patch: 2,
  prerelease: '',
  buildDate: '2026-10-25T11:09:46.053Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
