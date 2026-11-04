export const SITE_SEMVER = {
  major: 2,
  minor: 184,
  patch: 1,
  prerelease: '',
  buildDate: '2026-11-04T08:16:26.110Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
