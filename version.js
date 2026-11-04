export const SITE_SEMVER = {
  major: 2,
  minor: 184,
  patch: 3,
  prerelease: '',
  buildDate: '2026-11-04T18:03:18.891Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
