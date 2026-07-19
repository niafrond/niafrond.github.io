import { beforeEach, describe, expect, test } from '@jest/globals';
import { createDownloaderConfigManager, deriveCdnUrlFromApiUrl } from '../../lib/downloaderConfig.js';

describe('downloaderConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('deriveCdnUrlFromApiUrl', () => {
    test('swaps the port to 3002, keeping host/protocol', () => {
      expect(deriveCdnUrlFromApiUrl('http://192.168.8.149:3000')).toBe('http://192.168.8.149:3002');
    });

    test('returns the input unchanged when it is not a valid URL', () => {
      expect(deriveCdnUrlFromApiUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('getDownloaderCdnUrl', () => {
    test('uses the explicitly stored CDN URL when set', () => {
      localStorage.setItem('cdn-key', 'http://custom-cdn.local:9000');
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'http://192.168.8.149:3002',
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'http://192.168.8.149:3000',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('http://custom-cdn.local:9000');
    });

    // No CDN configured: derive from the *current* API URL rather than a
    // static default, so it follows the API URL when it changes at runtime
    // (e.g. relay mode syncing a master's API URL onto a relay client).
    test('derives from the current API URL when no CDN URL is stored', () => {
      localStorage.setItem('api-key', 'http://relay-master.local:3000');
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'http://192.168.8.149:3002',
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'http://192.168.8.149:3000',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('http://relay-master.local:3002');
    });

    test('falls back to cdnDefaultUrl when neither CDN nor API URL are configured', () => {
      const manager = createDownloaderConfigManager({
        cdnDefaultUrl: 'http://192.168.8.149:3002',
        cdnStorageKey: 'cdn-key',
        defaultUrl: '',
        storageKey: 'api-key',
      });

      expect(manager.getDownloaderCdnUrl()).toBe('http://192.168.8.149:3002');
    });
  });

  describe('saveFromForm', () => {
    test('persists the CDN input value under cdnStorageKey', () => {
      const cdnInputEl = { value: 'http://saved-cdn.local:3002' };
      const manager = createDownloaderConfigManager({
        cdnInputEl,
        cdnStorageKey: 'cdn-key',
        defaultUrl: 'http://192.168.8.149:3000',
        inputEl: { value: 'http://192.168.8.149:3000' },
        storageKey: 'api-key',
      });

      manager.saveFromForm();

      expect(localStorage.getItem('cdn-key')).toBe('http://saved-cdn.local:3002');
      expect(manager.getDownloaderCdnUrl()).toBe('http://saved-cdn.local:3002');
    });
  });
});
