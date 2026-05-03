// TODO: Ce fichier est mis à jour automatiquement lors des releases.
// Copiez la logique de flash-guess/version.js si vous intégrez un pipeline CI.
export const SITE_SEMVER = {
  major: 1,
  minor: 0,
  patch: 0,
  prerelease: '',
  buildDate: '2026-01-01T00:00:00.000Z',
};

export function getVersion() {
  const { major, minor, patch, prerelease } = SITE_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getBuildDate() {
  return SITE_SEMVER.buildDate || '';
}
