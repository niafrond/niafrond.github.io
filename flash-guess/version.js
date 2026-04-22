export const FLASHGUESS_SEMVER = {
  major: 1,
  minor: 2,
  patch: 0,
  prerelease: '',
  buildDate: '2026-04-22T07:52:47.976Z',
};

export function getFlashGuessVersion() {
  const { major, minor, patch, prerelease } = FLASHGUESS_SEMVER;
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

export function getFlashGuessBuildDate() {
  return FLASHGUESS_SEMVER.buildDate || '';
}
