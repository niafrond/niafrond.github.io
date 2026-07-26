import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  createDownloaderConfigManager,
  deriveCdnUrlFromApiUrl,
  deriveRelayUrlFromApiUrl,
  describeApiTestError,
  isLikelyMixedContentBlock,
  resolveCdnArtworkUrl,
} from '../../lib/downloaderConfig.js';

describe('downloaderConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isLikelyMixedContentBlock', () => {
    test('detects a "Failed to fetch" against a plain-http LAN host from a secure page', () => {
      const err = new TypeError('Failed to fetch');
      expect(isLikelyMixedContentBlock(err, 'http://vision:3000', true)).toBe(true);
    });

    test('does not trigger for localhost/127.0.0.1 targets (no mixed-content rule there)', () => {
      const err = new TypeError('Failed to fetch');
      expect(isLikelyMixedContentBlock(err, 'http://localhost:3000', true)).toBe(false);
      expect(isLikelyMixedContentBlock(err, 'http://127.0.0.1:3000', true)).toBe(false);
    });

    test('does not trigger for an https API URL', () => {
      const err = new TypeError('Failed to fetch');
      expect(isLikelyMixedContentBlock(err, 'https://vision:3000', true)).toBe(false);
    });

    test('does not trigger for an unrelated error message', () => {
      const err = new Error('HTTP 500');
      expect(isLikelyMixedContentBlock(err, 'http://vision:3000', true)).toBe(false);
    });

    test('does not trigger when the page itself is not a secure context', () => {
      const err = new TypeError('Failed to fetch');
      expect(isLikelyMixedContentBlock(err, 'http://vision:3000', false)).toBe(false);
    });
  });

  describe('describeApiTestError', () => {
    test('explains the mixed-content block instead of the raw "Failed to fetch"', () => {
      const err = new TypeError('Failed to fetch');
      const message = describeApiTestError(err, 'http://vision:3000', true);
      expect(message).toContain('contenu mixte');
      expect(message).toContain('http://vision:3000');
    });

    test('falls back to the raw error message otherwise', () => {
      const err = new Error('HTTP 500');
      expect(describeApiTestError(err, 'http://vision:3000', true)).toBe('HTTP 500');
    });
  });

  describe('deriveCdnUrlFromApiUrl', () => {
    test('returns the same base URL (reverse proxy routes by path, not by port)', () => {
      expect(deriveCdnUrlFromApiUrl('https://vision:8443')).toBe('https://vision:8443');
    });

    test('returns the input unchanged when it is not a valid URL', () => {
      expect(deriveCdnUrlFromApiUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('getDownloaderCdnUrl', () => {
    test('uses the explicitly stored CDN URL when set', () => {
      localStorage.setItem('cdn-key', 'http://custom-cdn.local:9000');
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'https://vision:8443',
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'https://vision:8443',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('http://custom-cdn.local:9000');
    });

    // No CDN configured: derive from the *current* API URL rather than a
    // static default, so it follows the API URL when it changes at runtime
    // (e.g. relay mode syncing a master's API URL onto a relay client).
    test('derives from the current API URL when no CDN URL is stored', () => {
      localStorage.setItem('api-key', 'http://relay-master.local:8080');
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'https://vision:8443',
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'https://vision:8443',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('http://relay-master.local:8080');
    });

    test('falls back to cdnDefaultUrl when neither CDN nor API URL are configured', () => {
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'https://vision:8443',
        cdnStorageKey: 'cdn-key',
        defaultUrl: '',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('https://vision:8443');
    });
  });

  describe('resolveCdnArtworkUrl', () => {
    // SPEC-13.3.9 — regression test: a bare `/api/artwork?cachePath=...`
    // reference must be prefixed with the CDN base URL (+ token) before it
    // reaches an <img src>, or the browser resolves it against the app's own
    // origin (e.g. the GitHub Pages deployment) instead of the CDN, 404-ing.
    test('prefixes a /api/artwork reference with the CDN base URL and token', () => {
      const url = resolveCdnArtworkUrl('/api/artwork?cachePath=%2Fmnt%2Fart.jpg', 'http://vision:3002', 'secret');
      expect(url).toBe('http://vision:3002/api/artwork?cachePath=%2Fmnt%2Fart.jpg&token=secret');
    });

    test('returns empty string when no CDN base URL is available', () => {
      expect(resolveCdnArtworkUrl('/api/artwork?cachePath=%2Fmnt%2Fart.jpg', '', 'secret')).toBe('');
    });

    test('returns empty string for an already-absolute or empty artwork ref (nothing to resolve)', () => {
      expect(resolveCdnArtworkUrl('https://mzstatic.com/art.jpg', 'http://vision:3002', 'secret')).toBe('');
      expect(resolveCdnArtworkUrl('', 'http://vision:3002', 'secret')).toBe('');
      expect(resolveCdnArtworkUrl(undefined, 'http://vision:3002', 'secret')).toBe('');
    });
  });

  describe('deriveRelayUrlFromApiUrl', () => {
    test('returns the same base URL (reverse proxy routes by path, not by port)', () => {
      expect(deriveRelayUrlFromApiUrl('https://vision:8443')).toBe('https://vision:8443');
    });

    test('returns the input unchanged when it is not a valid URL', () => {
      expect(deriveRelayUrlFromApiUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('getDownloaderRelayUrl', () => {
    // No override storage for the relay URL: it always tracks the current API
    // URL, unlike the CDN URL which can be pinned independently.
    test('derives from the current API URL', () => {
      localStorage.setItem('api-key', 'http://relay-master.local:8080');
      const manager = createDownloaderConfigManager({
        defaultUrl: 'https://vision:8443',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderRelayUrl()).toBe('http://relay-master.local:8080');
    });

    test('returns an empty string when no API URL is configured', () => {
      const manager = createDownloaderConfigManager({
        defaultUrl: '',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderRelayUrl()).toBe('');
    });
  });

  describe('saveFromForm', () => {
    test('persists the CDN input value under cdnStorageKey', () => {
      const cdnInputEl = { value: 'http://saved-cdn.local:3002' };
      const manager = createDownloaderConfigManager({
        cdnInputEl,
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'http://vision:3000',
        inputEl: { value: 'http://vision:3000' },
        storageKey: 'api-key',
      });

      manager.saveFromForm();

      expect(localStorage.getItem('cdn-key')).toBe('http://saved-cdn.local:3002');
      expect(manager.getDownloaderCdnUrl()).toBe('http://saved-cdn.local:3002');
    });
  });
});
