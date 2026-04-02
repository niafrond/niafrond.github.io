import { formatSemver } from '../match3-quest/version.js';

export const BLIND_TEST_SEMVER = {
  major: 1,
  minor: 0,
  patch: 0,
  prerelease: '',
};

export function getBlindTestVersion() {
  return formatSemver(BLIND_TEST_SEMVER);
}