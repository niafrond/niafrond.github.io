import { jest, describe, test, expect } from '@jest/globals';
import { createAudioSourceManager } from '../../lib/audioSourceManager.js';

describe('audioSourceManager', () => {
  test('evictTrackSource clears local and session blob references', () => {
    const sessionBlobCache = new Map([
      ['track-1', {
        url: 'blob:session-track-1',
        stems: {
          vocalsUrl: 'blob:session-vocals-1',
          instrumentalUrl: '',
          echoUrl: '',
          distortionUrl: '',
        },
      }],
    ]);
    const touchQueueItem = jest.fn();
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.revokeObjectURL = jest.fn();
    const manager = createAudioSourceManager({
      apiHealthMonitor: null,
      audioCacheName: 'dj-mix:test',
      getDownloaderApiUrl: () => '',
      onQueueUpdated: jest.fn(),
      sessionBlobCache,
      touchQueueItem,
    });
    const item = {
      id: 'track-1',
      uri: 'track-1',
      name: 'Track One',
      localBlobUrl: 'blob:item-track-1',
      localStemUrls: {
        vocalsUrl: 'blob:item-vocals-1',
        instrumentalUrl: '',
        echoUrl: '',
        distortionUrl: '',
      },
      persistedSourceUrl: '',
      sourceState: 'ready',
    };

    const trimmed = manager.evictTrackSource(item, { notify: false });

    expect(trimmed).toBe(true);
    expect(item.localBlobUrl).toBeNull();
    expect(item.localStemUrls).toBeNull();
    expect(item.sourceState).toBe('idle');
    expect(sessionBlobCache.size).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:item-track-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:item-vocals-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-track-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-vocals-1');
    expect(touchQueueItem).toHaveBeenCalled();

    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});
