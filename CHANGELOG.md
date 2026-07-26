## [2.15.0](https://github.com/niafrond/niafrond.github.io/compare/v2.14.0...v2.15.0) (2026-07-26)

### Features

* **short_loop:** implement capped short loop functionality with repeat limit and reset logic ([77f5bc5](https://github.com/niafrond/niafrond.github.io/commit/77f5bc55afed28264c4b8d3a28e286245148f848))

## [2.14.0](https://github.com/niafrond/niafrond.github.io/compare/v2.13.0...v2.14.0) (2026-07-25)

### Features

* update API and CDN URLs to use port 8080 for consistency across configurations ([a441997](https://github.com/niafrond/niafrond.github.io/commit/a441997da5ec9b9e259695164be05299a6122f3c))

## [2.13.0](https://github.com/niafrond/niafrond.github.io/compare/v2.12.0...v2.13.0) (2026-07-25)

### Features

* **playback:** implement stale target checks for deck playback to prevent audio interruptions ([df32e93](https://github.com/niafrond/niafrond.github.io/commit/df32e9313cd63f67e9413a03380fcf0ade75cb3c))

## [2.12.0](https://github.com/niafrond/niafrond.github.io/compare/v2.11.1...v2.12.0) (2026-07-24)

### Features

* **dj-mix:** add mixed content detection and error handling for API downloader ([998f137](https://github.com/niafrond/niafrond.github.io/commit/998f13775376e830f5a421bc4868ce350369679b))

## [2.11.1](https://github.com/niafrond/niafrond.github.io/compare/v2.11.0...v2.11.1) (2026-07-24)

### Bug Fixes

* **dj-mix:** ship service worker cache bumps so installed PWAs actually receive updates ([e15511b](https://github.com/niafrond/niafrond.github.io/commit/e15511b541d5d8b84bbcac39eb12a6db8cd2242f))

## [2.11.0](https://github.com/niafrond/niafrond.github.io/compare/v2.10.0...v2.11.0) (2026-07-24)

### Features

* Implement background artwork refresh for cached tracks and prevent stale zone leakage in next track selections ([5be2cd6](https://github.com/niafrond/niafrond.github.io/commit/5be2cd6f545fdf871b79636f59e772b37d6e8b74))
* update UI for round end display and add audio source handling ([07cf17e](https://github.com/niafrond/niafrond.github.io/commit/07cf17e37e0e578a9afdb7245e73b8897654aabc))

## [2.10.0](https://github.com/niafrond/niafrond.github.io/compare/v2.9.0...v2.10.0) (2026-07-23)

### Features

* Implement artwork URL upgrade to use CORS-enabled CDN references and persist changes ([3c65ec2](https://github.com/niafrond/niafrond.github.io/commit/3c65ec20d6160f9e0e7f385e75af22ed488908c9))

## [2.9.0](https://github.com/niafrond/niafrond.github.io/compare/v2.8.0...v2.9.0) (2026-07-23)

### Features

* Enhance relay functionality with persistent storage requests and command reordering ([72f4dc8](https://github.com/niafrond/niafrond.github.io/commit/72f4dc8a628fa093179e1dc1ae7c90b61cf75859))

## [2.8.0](https://github.com/niafrond/niafrond.github.io/compare/v2.7.0...v2.8.0) (2026-07-23)

### Features

* Update downloader API and CDN URLs to use 'vision' hostname ([9f14ea1](https://github.com/niafrond/niafrond.github.io/commit/9f14ea15ba132d78adefa15fcf50ff06479fc019))

## [2.7.0](https://github.com/niafrond/niafrond.github.io/compare/v2.6.0...v2.7.0) (2026-07-22)

### Features

* **dj-mix:** move relay incoming indicators into the queue and show next fil rouge track on relay ([69927cf](https://github.com/niafrond/niafrond.github.io/commit/69927cff235d1d6940bb335363604bda09cee73a))

## [2.6.0](https://github.com/niafrond/niafrond.github.io/compare/v2.5.0...v2.6.0) (2026-07-21)

### Features

* Add relay server URL derivation and integrate into relay mode management ([38fe6c5](https://github.com/niafrond/niafrond.github.io/commit/38fe6c5c027b23e8e8c6866edd6d9b117af8749c))

## [2.5.0](https://github.com/niafrond/niafrond.github.io/compare/v2.4.0...v2.5.0) (2026-07-21)

### Features

* Enhance beat_repeat functionality with progressive loop lengths and update queue management for immediate track insertion ([8568e40](https://github.com/niafrond/niafrond.github.io/commit/8568e40c7cc08cc6c02a0ef1a68dad7fc74824de))
* Update beat_repeat functionality to include final overlap phase and adjust related specifications ([8219516](https://github.com/niafrond/niafrond.github.io/commit/82195164dc1620ef29f52fe782af623303530f2e))

## [2.4.0](https://github.com/niafrond/niafrond.github.io/compare/v2.3.0...v2.4.0) (2026-07-21)

### Features

* Implement user-configurable transition mode disabling and enforce limits on beat_repeat duration ([b00260e](https://github.com/niafrond/niafrond.github.io/commit/b00260e61a65d6fa1a416f9daa08352950e16eb5))
* Refactor relay mode management to eliminate server-side session creation ([bf54c3d](https://github.com/niafrond/niafrond.github.io/commit/bf54c3d77461c00b9774df3a027f77d0d9855544))

## [2.3.0](https://github.com/niafrond/niafrond.github.io/compare/v2.2.0...v2.3.0) (2026-07-21)

### Features

* Implement device ID tracking in relay commands and update logging for rejections and failures ([4a41c8b](https://github.com/niafrond/niafrond.github.io/commit/4a41c8b6dd05fe583b7912196bb2b078b2ed5345))

## [2.2.0](https://github.com/niafrond/niafrond.github.io/compare/v2.1.0...v2.2.0) (2026-07-21)

### Features

* Add unit tests for relayQueueView and remove relayStreamController tests ([4c52fb2](https://github.com/niafrond/niafrond.github.io/commit/4c52fb2b17174d3ad1b3e560c2c406b99988bbdf))

## [2.1.0](https://github.com/niafrond/niafrond.github.io/compare/v2.0.0...v2.1.0) (2026-07-21)

### Features

* add refresh functionality for mix data in the queue ([201046c](https://github.com/niafrond/niafrond.github.io/commit/201046c4caad6e34251ef3223a3085c16ffc8a3c))
* implement relay incoming queue for track management ([c9383ff](https://github.com/niafrond/niafrond.github.io/commit/c9383ff1b1bf2a1f727bb0bca0faa3a740f292bb))
* remove fingerprint verification feature and replace with refresh mix data functionality ([54b3ed2](https://github.com/niafrond/niafrond.github.io/commit/54b3ed269c018aad066442a32e06bb9e5199ee66))

## [2.0.0](https://github.com/niafrond/niafrond.github.io/compare/v1.263.0...v2.0.0) (2026-07-19)

### ⚠ BREAKING CHANGES

* enhance DJ mix functionality with new sampling effects and local path database

### Features

* enhance DJ mix functionality with new sampling effects and local path database ([c53d157](https://github.com/niafrond/niafrond.github.io/commit/c53d1573366354a543b664765477eac4c801cb6a))

## [1.263.0](https://github.com/niafrond/niafrond.github.io/compare/v1.262.0...v1.263.0) (2026-07-19)

### Features

* implement audio CDN support for streaming and downloading tracks ([33c5293](https://github.com/niafrond/niafrond.github.io/commit/33c529382d2ae9300edb9d304735250d19e35bc0))

## [1.262.0](https://github.com/niafrond/niafrond.github.io/compare/v1.261.0...v1.262.0) (2026-07-18)

### Features

* implement shared trackStore for queue and fil rouge management ([62652d0](https://github.com/niafrond/niafrond.github.io/commit/62652d01b4ba2f13cc8a1b2421a1059953ec41be))

## [1.261.0](https://github.com/niafrond/niafrond.github.io/compare/v1.260.0...v1.261.0) (2026-07-18)

### Features

* Implement individual sample activation for sampling effects and update settings management ([efb94f4](https://github.com/niafrond/niafrond.github.io/commit/efb94f4b6943631391cad1bba30da5c766fd07ac))
* Remove Flanger/Phaser effect from the DJ FX catalogue and update related documentation and tests ([6d8355a](https://github.com/niafrond/niafrond.github.io/commit/6d8355a2a7b48c30716c5a5cb4a1ce24be5b79fa))

## [1.260.0](https://github.com/niafrond/niafrond.github.io/compare/v1.259.0...v1.260.0) (2026-07-15)

### Features

* Remove Scrum Poker application files including HTML, JavaScript, CSS, manifest, and peer networking logic. ([ceac5ee](https://github.com/niafrond/niafrond.github.io/commit/ceac5eef93bcd1366dd9ee7d9cf384ba2a4e501a))

## [1.259.0](https://github.com/niafrond/niafrond.github.io/compare/v1.258.2...v1.259.0) (2026-07-14)

### Features

* **dj-mix:** optimize download batch - sliding window pool, higher parallelism, fix first-download failures ([4131b2a](https://github.com/niafrond/niafrond.github.io/commit/4131b2a560b23110dbb1537a7bd88ba8c9967d50))

## [1.258.2](https://github.com/niafrond/niafrond.github.io/compare/v1.258.1...v1.258.2) (2026-07-14)

### Bug Fixes

* **pendu:** group word parts to prevent letter orphaning on wrap ([f93a3cd](https://github.com/niafrond/niafrond.github.io/commit/f93a3cd05ff1ffa99874bfdf7c2b23be184ac26f))

## [1.258.1](https://github.com/niafrond/niafrond.github.io/compare/v1.258.0...v1.258.1) (2026-07-14)

### Bug Fixes

* Merge pull request [#363](https://github.com/niafrond/niafrond.github.io/issues/363) from niafrond/copilot/pendu-mots-au-hasard ([8c28ff8](https://github.com/niafrond/niafrond.github.io/commit/8c28ff8948b7012092f37aacb3bc165896fabd10))
* **pendu:** handle œ/æ ligatures in random word mode ([a38fd41](https://github.com/niafrond/niafrond.github.io/commit/a38fd41e2bc4584099ffede49c59859dffdf25c8))

## [1.258.0](https://github.com/niafrond/niafrond.github.io/compare/v1.257.0...v1.258.0) (2026-07-14)

### Features

* **dj-mix:** persist download state to localStorage, preserve audio cache on PWA update ([2e597e0](https://github.com/niafrond/niafrond.github.io/commit/2e597e0ef267c3e7dc307cc6d5756f12878c052d))

## [1.257.0](https://github.com/niafrond/niafrond.github.io/compare/v1.256.0...v1.257.0) (2026-07-13)

### Features

* **dj-mix:** sampling FX joue de vrais samples audio au lieu d'un oscillateur ([0cd0d84](https://github.com/niafrond/niafrond.github.io/commit/0cd0d846143a6ec4d82f3e510006e518dae48b39))

## [1.256.0](https://github.com/niafrond/niafrond.github.io/compare/v1.255.0...v1.256.0) (2026-07-13)

### Features

* Add support for Wake Lock during internal queue processing and background fetch continuity ([6323317](https://github.com/niafrond/niafrond.github.io/commit/6323317ea0dd661837c8c7d4afa56d36e4ef2dbf))
* Implement backoff retry mechanism for background fetch failures ([4dcc85b](https://github.com/niafrond/niafrond.github.io/commit/4dcc85bbd1fa5e0fd83bfe4defaa5be1f34f3e59))

## [1.255.0](https://github.com/niafrond/niafrond.github.io/compare/v1.254.0...v1.255.0) (2026-07-12)

### Features

* implement forced PWA update functionality with service worker unregistration and cache clearing ([86c7aba](https://github.com/niafrond/niafrond.github.io/commit/86c7aba93ed903c80a079fc489ceeee7a28cdf67))

## [1.254.0](https://github.com/niafrond/niafrond.github.io/compare/v1.253.0...v1.254.0) (2026-07-12)

### Features

* Refactor filRougeDownloader to use downloadBatchManager for improved batch processing ([bebf7c0](https://github.com/niafrond/niafrond.github.io/commit/bebf7c03b6b8ec7aa0020d5bdeab217a7807b72f))
* remove 'fake_drop' transition mode and related references; add audio continuity specifications ([d5de008](https://github.com/niafrond/niafrond.github.io/commit/d5de0087b52fa326ca4f6600c654c739b7e1cc4c))
* remove verify_downloadbatch script to streamline download verification process ([a42a289](https://github.com/niafrond/niafrond.github.io/commit/a42a28932956d02d4f047ed9a9680d8465b38734))

## [1.253.0](https://github.com/niafrond/niafrond.github.io/compare/v1.252.0...v1.253.0) (2026-07-12)

### Features

* add functionality to fetch missing mix suggestions for already downloaded tracks ([0b24d93](https://github.com/niafrond/niafrond.github.io/commit/0b24d930b744f2c9d24c6e25366c44367534087d))
* implement concurrency handling for prefetchTrackToLocalCache to avoid duplicate downloads and improve performance ([95d6623](https://github.com/niafrond/niafrond.github.io/commit/95d66236c68acf39d03a94c82ece98707944e88a))

## [1.252.0](https://github.com/niafrond/niafrond.github.io/compare/v1.251.0...v1.252.0) (2026-07-11)

### Features

* remove polling mechanism from search functionality and update related API responses ([655b2e1](https://github.com/niafrond/niafrond.github.io/commit/655b2e168a8cb31d9ba3f1848261a755d631a8b6))

## [1.251.0](https://github.com/niafrond/niafrond.github.io/compare/v1.250.0...v1.251.0) (2026-07-10)

### Features

* add Plex mobile web proxy server with HLS playlist rewriting and health check endpoint ([62bd7f1](https://github.com/niafrond/niafrond.github.io/commit/62bd7f1ba5124548e9084987b9293ce2fc74dfaa))

## [1.250.0](https://github.com/niafrond/niafrond.github.io/compare/v1.249.0...v1.250.0) (2026-07-07)

### Features

* enhance downloadAll functionality to fetch mix data for completed tracks without mix info ([bd3488c](https://github.com/niafrond/niafrond.github.io/commit/bd3488c3d5310e2d0f0932d4bdff8c4d361ee6b6))

## [1.249.0](https://github.com/niafrond/niafrond.github.io/compare/v1.248.0...v1.249.0) (2026-07-07)

### Features

* **alldebrid-fdm:** initialize project with Express server and frontend ([570447e](https://github.com/niafrond/niafrond.github.io/commit/570447e25b7db7df21cf8dd0e7ee8cb3f20cdc5e))

## [1.248.0](https://github.com/niafrond/niafrond.github.io/compare/v1.247.0...v1.248.0) (2026-07-06)

### Features

* implement server tracks caching with TTL and add related tests ([c740ae2](https://github.com/niafrond/niafrond.github.io/commit/c740ae2563d47748cc08e711c68dbbae9af9032a))

## [1.247.0](https://github.com/niafrond/niafrond.github.io/compare/v1.246.0...v1.247.0) (2026-07-06)

### Features

* add search overlay functionality with open and close methods ([33239c5](https://github.com/niafrond/niafrond.github.io/commit/33239c581fa39c88f2edbb8fdb9998456f987ec1))
* update specifications and tests for track handling in DJ functionality ([734ec37](https://github.com/niafrond/niafrond.github.io/commit/734ec37b274e09a738856e5ae70b2018269d8386))

## [1.246.0](https://github.com/niafrond/niafrond.github.io/compare/v1.245.0...v1.246.0) (2026-07-06)

### Features

* add unit tests for downloadAll functionality in filRougeDownloader ([ef7eb41](https://github.com/niafrond/niafrond.github.io/commit/ef7eb412fab6503490615105e154d2cd32a94487))
* enhance DJ effects controller and fil rouge functionality ([02c9309](https://github.com/niafrond/niafrond.github.io/commit/02c930961a75e8d40081629d0cc1d324fdfcd5ee))

## [1.245.0](https://github.com/niafrond/niafrond.github.io/compare/v1.244.0...v1.245.0) (2026-07-05)

### Features

* add 'pattern' sorting mode to playlist and enhance artwork handling with API integration ([5529f5c](https://github.com/niafrond/niafrond.github.io/commit/5529f5cfaf00b1233e0fc0d2ab020ab4b5fd1d2b))

## [1.244.0](https://github.com/niafrond/niafrond.github.io/compare/v1.243.0...v1.244.0) (2026-07-04)

### Features

* add playlist sorting functionality with API integration and related tests ([1d58b35](https://github.com/niafrond/niafrond.github.io/commit/1d58b357f30f529ed994ada7290109c9eb70457e))

## [1.243.0](https://github.com/niafrond/niafrond.github.io/compare/v1.242.0...v1.243.0) (2026-07-03)

### Features

* implement automatic pause on audio output change for active deck and add related tests ([6c65890](https://github.com/niafrond/niafrond.github.io/commit/6c65890fc8c57f82a7073f5717bc41382dc1c894))

## [1.242.0](https://github.com/niafrond/niafrond.github.io/compare/v1.241.0...v1.242.0) (2026-07-03)

### Features

* add fallback logic for automix timing based on track max duration and update tests for transition plan behavior ([7a203de](https://github.com/niafrond/niafrond.github.io/commit/7a203deccb5c6530de3b3934dfda3c050f73b5c4))
* enhance fil rouge manager tests with loop behavior and peek track logic ([7baa19d](https://github.com/niafrond/niafrond.github.io/commit/7baa19d14c4c70a6879cbe211f0ad5c4ef0bdec5))
* implement inactive preload watcher and enhance artwork handling for media session ([5e56e37](https://github.com/niafrond/niafrond.github.io/commit/5e56e372e53a8165bcbbddb23a74ab1eb56f621c))
* implement onTrackStarted callback to trigger quality refresh on track start and add related tests ([bc7ba1d](https://github.com/niafrond/niafrond.github.io/commit/bc7ba1d223908eefd90cc07fe9dc1ba186431c97))

## [1.241.0](https://github.com/niafrond/niafrond.github.io/compare/v1.240.0...v1.241.0) (2026-06-30)

### Features

* add volume control UI and functionality ([68181f2](https://github.com/niafrond/niafrond.github.io/commit/68181f2850552c1cc222a59568b7fb287921690d))
* enhance artwork fetching logic with optional notification suppression ([04ffbe5](https://github.com/niafrond/niafrond.github.io/commit/04ffbe5b6faec074ddbf3328bafad06e17c2e8c9))
* update artwork fetching logic to suppress notifications during preloading on inactive deck ([39e5326](https://github.com/niafrond/niafrond.github.io/commit/39e532669797d72791ca3122558f9353bd3c43b6))

## [1.240.0](https://github.com/niafrond/niafrond.github.io/compare/v1.239.0...v1.240.0) (2026-06-30)

### Features

* add specifications for queue display and update UI rendering logic ([d75f165](https://github.com/niafrond/niafrond.github.io/commit/d75f1652dfc3cf196c3afc47b0853b013e6bff5f))

## [1.239.0](https://github.com/niafrond/niafrond.github.io/compare/v1.238.0...v1.239.0) (2026-06-30)

### Features

* add specifications for queue display and update UI rendering logic ([5c4cbe3](https://github.com/niafrond/niafrond.github.io/commit/5c4cbe302fc2c9a4d37d33898a2c0a014ed08daf))
* **android-auto:** integrate Android Auto support with media session and adaptive download batching ([db4529a](https://github.com/niafrond/niafrond.github.io/commit/db4529a2514f3a7a3f95430305281d5520f392cd))

## [1.238.0](https://github.com/niafrond/niafrond.github.io/compare/v1.237.0...v1.238.0) (2026-06-30)

### Features

* add DJ Plan section with recalculation button and styling ([5eb14f6](https://github.com/niafrond/niafrond.github.io/commit/5eb14f6a3eb73da0e799f1a354c98d77e2e50bbd))
* update specifications for asynchronous callbacks and metadata fetching logic ([db052c0](https://github.com/niafrond/niafrond.github.io/commit/db052c024b7a1fa1f513e37372a1203e55629a7e))

## [1.237.0](https://github.com/niafrond/niafrond.github.io/compare/v1.236.0...v1.237.0) (2026-06-29)

### Features

* add track time display and improve caching logic for downloads ([6d849f8](https://github.com/niafrond/niafrond.github.io/commit/6d849f8f2019d13636397cddb8ccc9660376dd4f))
* Add unit tests for Fil Rouge, Search, Auto DJ, Auto FX, and Mix Features ([7831f5f](https://github.com/niafrond/niafrond.github.io/commit/7831f5f8a77611c13397ffe73f30fd5cbb94cb40))
* enhance transition recalculation logic and add error handling ([4356868](https://github.com/niafrond/niafrond.github.io/commit/4356868e1d13cc29cae0ee598ef2183983f870f0))

## [1.236.0](https://github.com/niafrond/niafrond.github.io/compare/v1.235.0...v1.236.0) (2026-06-26)

### Features

* implement fingerprint control and suggestion handling in DJ Mix ([1501833](https://github.com/niafrond/niafrond.github.io/commit/1501833e5338a0eaa7ebe1dd5f664a1e7684981d))

## [1.235.0](https://github.com/niafrond/niafrond.github.io/compare/v1.234.1...v1.235.0) (2026-06-26)

### Features

* add next track display and fingerprint control functionality ([1a4c252](https://github.com/niafrond/niafrond.github.io/commit/1a4c252945f82984a7a80b6a43ef575d15dc58cb))
* add search functionality with overlay and action sheet ([c5ba1a2](https://github.com/niafrond/niafrond.github.io/commit/c5ba1a2bcec008e79f0515491089aa6fea31351d))

## [1.234.1](https://github.com/niafrond/niafrond.github.io/compare/v1.234.0...v1.234.1) (2026-06-24)

### Bug Fixes

* pendu - correct multi-occurrence letters and auto-display non-alpha chars ([ccddd26](https://github.com/niafrond/niafrond.github.io/commit/ccddd268bd3b0182f69ed45ce814ce56f04987ce))

## [1.234.0](https://github.com/niafrond/niafrond.github.io/compare/v1.233.1...v1.234.0) (2026-06-24)

### Features

* **pendu:** afficher le mot proposé à la place de la lettre en mode IndicePendu ([a2531fd](https://github.com/niafrond/niafrond.github.io/commit/a2531fdbd8535561334952aad91cbcb726d1cfc3))

## [1.233.1](https://github.com/niafrond/niafrond.github.io/compare/v1.233.0...v1.233.1) (2026-06-23)

### Bug Fixes

* **pendu:** rename mode to IndicePendu and display hint word in prompt ([22b31d3](https://github.com/niafrond/niafrond.github.io/commit/22b31d3703467884d228935872624310998454c2))

## [1.233.0](https://github.com/niafrond/niafrond.github.io/compare/v1.232.0...v1.233.0) (2026-06-19)

### Features

* **pendu:** add random word button using flash-guess word lists ([1c1e19d](https://github.com/niafrond/niafrond.github.io/commit/1c1e19d163dbd5481495054ddbd12e3f33b011a5))

## [1.232.0](https://github.com/niafrond/niafrond.github.io/compare/v1.231.0...v1.232.0) (2026-06-19)

### Features

* add jeu de pendu 2 joueurs (single phone) ([d7e4bf4](https://github.com/niafrond/niafrond.github.io/commit/d7e4bf436f0d000dd642565198b7ce3c45d36d89))

## [1.231.0](https://github.com/niafrond/niafrond.github.io/compare/v1.230.0...v1.231.0) (2026-06-17)

### Features

* refine auto transition selection logic in DJPlayer ([f4f51f6](https://github.com/niafrond/niafrond.github.io/commit/f4f51f69a946657b2e9f2321cf2d97f75bca60eb))

## [1.230.0](https://github.com/niafrond/niafrond.github.io/compare/v1.229.0...v1.230.0) (2026-06-17)

### Features

* add fullscreen button and functionality to relay interface ([8d2cd3c](https://github.com/niafrond/niafrond.github.io/commit/8d2cd3cc99727c74bf4478db954fbfec86cb62c8))
* add lightweight relay player and UI enhancements ([40687fb](https://github.com/niafrond/niafrond.github.io/commit/40687fbb1f074b8e2d6fd8de3a0796fec225c91c))
* enhance DJ plan UI with transition and FX labels; add search result handling ([5b7231c](https://github.com/niafrond/niafrond.github.io/commit/5b7231c00c1d704313104bceeecc77bab9766a6e))
* implement weighted auto transition selection for DJPlayer ([1c0ee0b](https://github.com/niafrond/niafrond.github.io/commit/1c0ee0bae6a5b44403c56f0338de25c11f6d1f7c))

## [1.229.0](https://github.com/niafrond/niafrond.github.io/compare/v1.228.0...v1.229.0) (2026-06-17)

### Features

* add refresh functionality for API Mix playlists on button click ([f07a35d](https://github.com/niafrond/niafrond.github.io/commit/f07a35d6a4bad7ae7ca7f8a8bf24874a4dcb6c5b))
* implement DJ Plan indicator logic and UI; add playlist selection from server with refresh functionality ([69c58d6](https://github.com/niafrond/niafrond.github.io/commit/69c58d6296cc9bee422c8ffea32ed79a93f2b584))

## [1.228.0](https://github.com/niafrond/niafrond.github.io/compare/v1.227.0...v1.228.0) (2026-06-16)

### Features

* add fetchBatchPlanByProfile and computeSetQualityByProfile functions; update event listener for profile changes to compute set quality ([72edba2](https://github.com/niafrond/niafrond.github.io/commit/72edba2f04ec2369f81fe1a78d83c9e9fbb023ab))
* enhance DJ Mix functionality with retrain engine feature and UI updates ([5ed29dc](https://github.com/niafrond/niafrond.github.io/commit/5ed29dc57e98e22e08b1ab974ed6515ef0a9d0b3))
* remove Android-specific files and configurations for DJ Mix project ([ac72fa6](https://github.com/niafrond/niafrond.github.io/commit/ac72fa6f767b8181ae9acf80bcb2838000914f90))
* rename retrain button to recalculate and update functionality; add dev build indicator for local testing ([d01b35c](https://github.com/niafrond/niafrond.github.io/commit/d01b35c21fc30f3dae33b9ef5c1582cfd89547e9))

## [1.227.0](https://github.com/niafrond/niafrond.github.io/compare/v1.226.0...v1.227.0) (2026-06-16)

### Features

* implement batch processing for track prefetching to improve performance and error handling ([f6bc5ae](https://github.com/niafrond/niafrond.github.io/commit/f6bc5ae43a019e4d7b1cfeebf79ca985b41c944f))

## [1.226.0](https://github.com/niafrond/niafrond.github.io/compare/v1.225.0...v1.226.0) (2026-06-16)

### Features

* add DJ external plan functionality with UI updates and transitions management ([f18bb64](https://github.com/niafrond/niafrond.github.io/commit/f18bb64897e28946188ef66206ca4700e57b15f9))
* add DJ feedback and transition management features ([946d50a](https://github.com/niafrond/niafrond.github.io/commit/946d50a8fdd66c21d7f18350b89c1cff5a914a34))
* update DJ plan manager logic to handle cases with no trackIds and improve artwork fetching ([39ccff4](https://github.com/niafrond/niafrond.github.io/commit/39ccff4cc48b10ae71d5afd39b0e5de26d8479f7))

## [1.225.0](https://github.com/niafrond/niafrond.github.io/compare/v1.224.0...v1.225.0) (2026-06-15)

### Features

* add API token input and enhance downloader API integration ([c7f08de](https://github.com/niafrond/niafrond.github.io/commit/c7f08de1fe6845fa9c133f71cdaecf71767919da))

## [1.224.0](https://github.com/niafrond/niafrond.github.io/compare/v1.223.0...v1.224.0) (2026-06-10)

### Features

* improve artwork and metadata handling in addToFilRouge function ([5e597cf](https://github.com/niafrond/niafrond.github.io/commit/5e597cf15b90c34c81c7d34c49b56b94b5c1ae02))

## [1.223.0](https://github.com/niafrond/niafrond.github.io/compare/v1.222.0...v1.223.0) (2026-06-10)

### Features

* **android-auto:** add AndroidManifest.xml with media config for Android Auto ([560b6a7](https://github.com/niafrond/niafrond.github.io/commit/560b6a73d63a7ee611a3d051ac382f818c7f62ec))

## [1.222.0](https://github.com/niafrond/niafrond.github.io/compare/v1.221.0...v1.222.0) (2026-06-10)

### Features

* enhance Android Auto integration with data URI support for artwork ([a3c2ab5](https://github.com/niafrond/niafrond.github.io/commit/a3c2ab5591433cd49a1f4e6c23412826bd3a0184))

## [1.221.0](https://github.com/niafrond/niafrond.github.io/compare/v1.220.0...v1.221.0) (2026-06-10)

### Features

* enable mixed content for local API access in WebView ([c4a7421](https://github.com/niafrond/niafrond.github.io/commit/c4a7421989a2e651c80d717c8e304afcbb27f247))

## [1.220.0](https://github.com/niafrond/niafrond.github.io/compare/v1.219.2...v1.220.0) (2026-06-10)

### Features

* request local network access for self-hosted download API ([43781aa](https://github.com/niafrond/niafrond.github.io/commit/43781aae7658d67636dc53bdf037bea4955cf474))

## [1.219.2](https://github.com/niafrond/niafrond.github.io/compare/v1.219.1...v1.219.2) (2026-06-10)

### Bug Fixes

* **dj-mix-android:** allow cleartext HTTP for the local downloader API ([e110ec2](https://github.com/niafrond/niafrond.github.io/commit/e110ec26693d21ddb9f7b541471e14ab31a81b39))

## [1.219.1](https://github.com/niafrond/niafrond.github.io/compare/v1.219.0...v1.219.1) (2026-06-10)

### Bug Fixes

* **dj-mix-android:** unbox Double from PluginCall.getDouble before primitive cast ([0e68d43](https://github.com/niafrond/niafrond.github.io/commit/0e68d4339ad9a17e0cedf0a956893bce4ea8d854))

## [1.219.0](https://github.com/niafrond/niafrond.github.io/compare/v1.218.10...v1.219.0) (2026-06-10)

### Features

* add Android Auto support with MediaSession and APK updater ([91c482f](https://github.com/niafrond/niafrond.github.io/commit/91c482f4461efe5006d3ab33beb5819cb3aab137))

## [1.218.10](https://github.com/niafrond/niafrond.github.io/compare/v1.218.9...v1.218.10) (2026-06-10)

### Bug Fixes

* search issues ([53b2436](https://github.com/niafrond/niafrond.github.io/commit/53b2436306485403df6cbe4c5944fdc7fd149a22))

## [1.218.9](https://github.com/niafrond/niafrond.github.io/compare/v1.218.8...v1.218.9) (2026-06-09)

### Bug Fixes

* animation ([5d2050e](https://github.com/niafrond/niafrond.github.io/commit/5d2050e1f97dcdf6348ce5352672d643b90c7d14))
* djmix official music app ([4d42aaf](https://github.com/niafrond/niafrond.github.io/commit/4d42aaf103eb41d14b96817f46c4f13cecd1cfd1))

## [1.218.8](https://github.com/niafrond/niafrond.github.io/compare/v1.218.7...v1.218.8) (2026-06-08)

### Bug Fixes

* update sw ([293b969](https://github.com/niafrond/niafrond.github.io/commit/293b969c09c97794d463673d66ad8f378417d9e1))

## [1.218.7](https://github.com/niafrond/niafrond.github.io/compare/v1.218.6...v1.218.7) (2026-06-08)

### Bug Fixes

* scratch ([fbeedbe](https://github.com/niafrond/niafrond.github.io/commit/fbeedbe3dcfdccc5fb53d5cbdfc2ee46647f9c20))

## [1.218.6](https://github.com/niafrond/niafrond.github.io/compare/v1.218.5...v1.218.6) (2026-06-07)

### Bug Fixes

* ui mix ([99e57f7](https://github.com/niafrond/niafrond.github.io/commit/99e57f7439c21c2762631fa43a34dd5ff1667655))

## [1.218.5](https://github.com/niafrond/niafrond.github.io/compare/v1.218.4...v1.218.5) (2026-06-03)

### Bug Fixes

* ui ([1a3823b](https://github.com/niafrond/niafrond.github.io/commit/1a3823b8f5563aff2f06d4ae72f8de81f5fdd1e7))

## [1.218.4](https://github.com/niafrond/niafrond.github.io/compare/v1.218.3...v1.218.4) (2026-06-03)

### Bug Fixes

* ui ([c63c84d](https://github.com/niafrond/niafrond.github.io/commit/c63c84d770a13798ac710dddacd6a1c2628cbcd7))

## [1.218.3](https://github.com/niafrond/niafrond.github.io/compare/v1.218.2...v1.218.3) (2026-06-02)

### Bug Fixes

* large text ([36d0a7e](https://github.com/niafrond/niafrond.github.io/commit/36d0a7e5f25968bfabf15b8cc363875e25f96f01))

## [1.218.2](https://github.com/niafrond/niafrond.github.io/compare/v1.218.1...v1.218.2) (2026-06-02)

### Bug Fixes

* optimisations ([ca59dc0](https://github.com/niafrond/niafrond.github.io/commit/ca59dc001b687483d5312d00bec0ee481273994b))

## [1.218.1](https://github.com/niafrond/niafrond.github.io/compare/v1.218.0...v1.218.1) (2026-06-02)

### Bug Fixes

* automode ([7566da9](https://github.com/niafrond/niafrond.github.io/commit/7566da9cd91c53ba4526ce9272875247ced62396))

## [1.218.0](https://github.com/niafrond/niafrond.github.io/compare/v1.217.0...v1.218.0) (2026-06-01)

### Features

* implement cache eviction logic for session blobs and mix data, enhance track played detection with ID variants ([4e63eed](https://github.com/niafrond/niafrond.github.io/commit/4e63eed3e43b9a4322f587cfcddcd9e5e429b1ec))

## [1.217.0](https://github.com/niafrond/niafrond.github.io/compare/v1.216.0...v1.217.0) (2026-06-01)

### Features

* implement track max duration mode and percentage settings with UI updates ([33b860e](https://github.com/niafrond/niafrond.github.io/commit/33b860ebb49a42c86eba9d411202786c58c9b781))
* optimize deck metadata rendering to reduce redundant DOM updates ([f435f49](https://github.com/niafrond/niafrond.github.io/commit/f435f497c2fee0588fcc9bfac28ed976bd1103a1))

## [1.216.0](https://github.com/niafrond/niafrond.github.io/compare/v1.215.0...v1.216.0) (2026-06-01)

### Features

* add peekNextAutoFxEvent function and optimize planned start marker updates ([0154857](https://github.com/niafrond/niafrond.github.io/commit/0154857cc2cba5e7403ecb8ff53713731d9883c2))
* add raw max-duration marker for visual tracking of unaltered playback position ([c63c136](https://github.com/niafrond/niafrond.github.io/commit/c63c136cd9a428c085d3cc1bb5731b6a62b3106f))
* enhance automix functionality and improve track navigation buttons ([cb4b161](https://github.com/niafrond/niafrond.github.io/commit/cb4b16116c79d14e4e8bb6ba6f820a23f8330f4e))
* enhance transition logic by snapping to nearby outro zones for smoother mixes ([92e0eae](https://github.com/niafrond/niafrond.github.io/commit/92e0eaea7ab809d3bc59a753f240690cd9fa6e46))
* enhance transition zone selection logic and improve track exclusion checks ([a55293c](https://github.com/niafrond/niafrond.github.io/commit/a55293caaf5d5e5bcb008b2bdc3b165c6abdbb2b))
* implement max duration marker logic to trigger automix and adjust playback timing ([7bddd53](https://github.com/niafrond/niafrond.github.io/commit/7bddd53328ecae3256c7bf46b7d44f08d0d56c24))
* implement track metadata caching and improve artwork fetching logic ([e9177b7](https://github.com/niafrond/niafrond.github.io/commit/e9177b741823ca023eed9f83a0cab7cd2f16e5d8))

## [1.215.0](https://github.com/niafrond/niafrond.github.io/compare/v1.214.0...v1.215.0) (2026-06-01)

### Features

* add never miss zones for essential moments and update styling for visual distinction ([232e2fe](https://github.com/niafrond/niafrond.github.io/commit/232e2fe4b83e6d806e628a703a8803b193edb2ce))

## [1.214.0](https://github.com/niafrond/niafrond.github.io/compare/v1.213.0...v1.214.0) (2026-05-31)

### Features

* add peek functionality for next track and implement wake lock management ([010f69b](https://github.com/niafrond/niafrond.github.io/commit/010f69b1197f5629fa82a1cfa5cbb6df22c9f0c6))
* enhance max duration handling by incorporating track start offsets for accurate playback timing ([c768fee](https://github.com/niafrond/niafrond.github.io/commit/c768feea730d63f887ac6236b7eca525a4677905))
* enhance zone penalty logic for max-duration targets and clean up duplicate hint display ([5e3584a](https://github.com/niafrond/niafrond.github.io/commit/5e3584a7693da6a56b1c4427832d93c7f53e0d3f))
* fetch mix data for fil rouge tracks to enhance transition recommendations ([cde5345](https://github.com/niafrond/niafrond.github.io/commit/cde534549d52d3359e4e1ec92e239efa2c13f119))

## [1.213.0](https://github.com/niafrond/niafrond.github.io/compare/v1.212.0...v1.213.0) (2026-05-30)

### Features

* add loop and shuffle options for playlist management and persist settings ([a889615](https://github.com/niafrond/niafrond.github.io/commit/a8896152d7b5d4f293d6e961b69e68ee68b94604))

## [1.212.0](https://github.com/niafrond/niafrond.github.io/compare/v1.211.2...v1.212.0) (2026-05-30)

### Features

* update source badge styling and remove duration display in queue ([301ad72](https://github.com/niafrond/niafrond.github.io/commit/301ad72906b85538514b2dbe1b3565c55256d6a3))

## [1.211.2](https://github.com/niafrond/niafrond.github.io/compare/v1.211.1...v1.211.2) (2026-05-30)

### Performance Improvements

* **dj-mix:** debounce renderQueue/saveQueue and serialize background tasks to reduce playback stuttering ([91851ca](https://github.com/niafrond/niafrond.github.io/commit/91851cadcc68450d501a04d1696f8b68541ae195))

## [1.211.1](https://github.com/niafrond/niafrond.github.io/compare/v1.211.0...v1.211.1) (2026-05-28)

### Bug Fixes

* auto-mix ne se déclenchait pas sur les chansons fil rouge ([bb41359](https://github.com/niafrond/niafrond.github.io/commit/bb41359367a93981a272bfc1eafa48ff752ca760))

## [1.211.0](https://github.com/niafrond/niafrond.github.io/compare/v1.210.0...v1.211.0) (2026-05-27)

### Features

* add suggestion search toggle for auto DJ mode ([44c9857](https://github.com/niafrond/niafrond.github.io/commit/44c9857c4013bfd2f2b4b6253a07b32a3315b84f))

## [1.210.0](https://github.com/niafrond/niafrond.github.io/compare/v1.209.0...v1.210.0) (2026-05-26)

### Features

* **dj-mix:** add TXT playlist import for fil rouge ([f913026](https://github.com/niafrond/niafrond.github.io/commit/f9130267760bf4d76841da7940579cec975f67a8))

## [1.209.0](https://github.com/niafrond/niafrond.github.io/compare/v1.208.0...v1.209.0) (2026-05-26)

### Features

* add Spotify connection badge and enhance UI for connection status ([d2ac451](https://github.com/niafrond/niafrond.github.io/commit/d2ac4511b478b87c2e59b8ef528d6d9e4e9ef8fd))
* add Spotify playlist history storage key and enhance UI for playlist selection ([217b5e8](https://github.com/niafrond/niafrond.github.io/commit/217b5e87e19c92f744fb5c241276890d54e17e93))
* implement priority queue for fil rouge playlist management and enhance Spotify fetch retry logic ([fe9fa7b](https://github.com/niafrond/niafrond.github.io/commit/fe9fa7b377de11e5d0181c3f2bc91705d6e63b2b))

## [1.208.0](https://github.com/niafrond/niafrond.github.io/compare/v1.207.1...v1.208.0) (2026-05-25)

### Features

* sequential Spotify playlist prefetch to local cache ([024473d](https://github.com/niafrond/niafrond.github.io/commit/024473d24ff582970779867109695617cfab3feb))

## [1.207.1](https://github.com/niafrond/niafrond.github.io/compare/v1.207.0...v1.207.1) (2026-05-25)

### Bug Fixes

* prevent horizontal overflow in mix-blind-test layout ([c6a2be0](https://github.com/niafrond/niafrond.github.io/commit/c6a2be0a5f7eb06ab71eb76c30fb17c482dabc42))

## [1.207.0](https://github.com/niafrond/niafrond.github.io/compare/v1.206.2...v1.207.0) (2026-05-24)

### Features

* **mix-blind-test:** add manual stem volume sliders ([70415e7](https://github.com/niafrond/niafrond.github.io/commit/70415e7f306ec370a7b0952c145ad9d547f8d474))
* **mix-blind-test:** add pre-listen combo preview controls ([a83cbae](https://github.com/niafrond/niafrond.github.io/commit/a83cbae9e66f91250711d2c60037e933256c65e2))

## [1.206.2](https://github.com/niafrond/niafrond.github.io/compare/v1.206.1...v1.206.2) (2026-05-24)

### Bug Fixes

* **mix-blind-test:** use server cache endpoint for track import ([5310eca](https://github.com/niafrond/niafrond.github.io/commit/5310eca3914fc6459c2734a6b276ea0dc2e64721))

## [1.206.1](https://github.com/niafrond/niafrond.github.io/compare/v1.206.0...v1.206.1) (2026-05-24)

### Bug Fixes

* **mix-blind-test:** make song add resilient and explicit on duplicates ([fe3556a](https://github.com/niafrond/niafrond.github.io/commit/fe3556a44f8b1333f8581c87d5d193ec17ce19bc))

## [1.206.0](https://github.com/niafrond/niafrond.github.io/compare/v1.205.0...v1.206.0) (2026-05-24)

### Features

* **mix-blind-test:** add bulk random DJ mix import ([66f4909](https://github.com/niafrond/niafrond.github.io/commit/66f4909483ac1c1d200c96ecf91fc842d9d5af5b))

## [1.205.0](https://github.com/niafrond/niafrond.github.io/compare/v1.204.0...v1.205.0) (2026-05-24)

### Features

* add mix blind test app with stem-based rounds ([aaf2ff2](https://github.com/niafrond/niafrond.github.io/commit/aaf2ff2f228d471eeb9a31b19037288a28f9c98b))

## [1.204.0](https://github.com/niafrond/niafrond.github.io/compare/v1.203.0...v1.204.0) (2026-05-24)

### Features

* **dj-mix:** add playlist fil rouge with priority queue ([486e1b4](https://github.com/niafrond/niafrond.github.io/commit/486e1b4df3938279df6dbb06ad5b5cb9e6d80a5d))

## [1.203.0](https://github.com/niafrond/niafrond.github.io/compare/v1.202.1...v1.203.0) (2026-05-20)

### Features

* **geo-party:** add timer options and world region filter ([5ac773b](https://github.com/niafrond/niafrond.github.io/commit/5ac773bd842d07bb3d1aea6a13c28e3b50be17f2))
* **geo-party:** auto-submit on timer end, post-validation lock, per-player status chips ([fdd75a2](https://github.com/niafrond/niafrond.github.io/commit/fdd75a28a796c20b6760336f027645d7c148a022))
* **geo-party:** fix panorama retry + add unit tests ([036fbee](https://github.com/niafrond/niafrond.github.io/commit/036fbee3f93309e7ec8342323be0c333056d7c96))

### Bug Fixes

* **geo-party:** clamp rounds to available locations for selected region ([8322a36](https://github.com/niafrond/niafrond.github.io/commit/8322a3623fa3cb89801a8ddfb2c12f5e5fdc4853))
* **geo-party:** Easter Island → oceanie; remove redundant spread in pickLocations ([a54c355](https://github.com/niafrond/niafrond.github.io/commit/a54c355144e075a05c941f41a6b735f7340dc9ba))
* **geo-party:** finalize conflict resolution and clamp rounds by region ([9500323](https://github.com/niafrond/niafrond.github.io/commit/9500323dbfc79a3b771994bc1d6d0f48d7dee8da))

## [1.202.1](https://github.com/niafrond/niafrond.github.io/compare/v1.202.0...v1.202.1) (2026-05-20)

### Bug Fixes

* reduce dj-mix memory pressure on mobile ([6dd7afa](https://github.com/niafrond/niafrond.github.io/commit/6dd7afa529bd434104cbfb501b364d2f6e068453))

## [1.202.0](https://github.com/niafrond/niafrond.github.io/compare/v1.201.0...v1.202.0) (2026-05-20)

### Features

* **dj-mix:** detect API offline and disable API calls with local fallback ([3d4a8ad](https://github.com/niafrond/niafrond.github.io/commit/3d4a8ada7ade6a30631d0c092d190d6019df73cb))

## [1.201.0](https://github.com/niafrond/niafrond.github.io/compare/v1.200.0...v1.201.0) (2026-05-20)

### Features

* implement DJ mode configuration and default dance genre preferences, enhance UI elements ([c5618b7](https://github.com/niafrond/niafrond.github.io/commit/c5618b76a6caed4dd7446bdaab6ad92fcdae4bc5))

## [1.200.0](https://github.com/niafrond/niafrond.github.io/compare/v1.199.0...v1.200.0) (2026-05-19)

### Features

* add low-pass and high-pass filter options, enhance suggestion functionality, and improve UI layout ([f86f93b](https://github.com/niafrond/niafrond.github.io/commit/f86f93b1c8a8ca54e32f9a935fa75f555ab29773))
* enhance auto DJ FX settings with max interval input and update UI ([da7fe18](https://github.com/niafrond/niafrond.github.io/commit/da7fe180cc0fe0bc835291f12ba1e40201bb2f81))
* enhance auto mode manager with vocal sensitivity adjustments and improved transition recommendations ([ebd5857](https://github.com/niafrond/niafrond.github.io/commit/ebd5857d2ed8036c135e31002e4e1a6f9b2921a0))
* enhance media session support with artwork and playback controls, improve search functionality ([2792f89](https://github.com/niafrond/niafrond.github.io/commit/2792f893bf806f9e9025b120fca19c057caf7efc))
* implement genre selection dropdown and enhance BPM/genre extraction for dance mode ([db41e29](https://github.com/niafrond/niafrond.github.io/commit/db41e294c76d096c6c11087a4ebad57eb49dff8d))
* **tests:** enhance e2e and unit tests for DJ Mix application ([3a78c49](https://github.com/niafrond/niafrond.github.io/commit/3a78c49fa6140500b5a849bdfc19d08f30fb4b9e))
* update genre selection functionality and UI, enhance default settings for auto DJ effects ([4aa5e08](https://github.com/niafrond/niafrond.github.io/commit/4aa5e0808679ab6c7850310d9d2a64af34d5bdc6))

## [1.199.0](https://github.com/niafrond/niafrond.github.io/compare/v1.198.0...v1.199.0) (2026-05-17)

### Features

* **dj-mix:** add RAM filter configuration and transition mode management ([98ae28b](https://github.com/niafrond/niafrond.github.io/commit/98ae28b3a94b5e6c8bb142798183d296fa0dce51))
* enhance DJPlayer with smooth playback rate transitions and new deck features ([25f931b](https://github.com/niafrond/niafrond.github.io/commit/25f931bd8ccbe846f1dc4a670f7c0fd4055f71bc))

## [1.198.0](https://github.com/niafrond/niafrond.github.io/compare/v1.197.0...v1.198.0) (2026-05-17)

### Features

* add dj-mix cache filters ([0e0fa4b](https://github.com/niafrond/niafrond.github.io/commit/0e0fa4b7c420c4d3a8211489ad784fc6b291209f))

## [1.197.0](https://github.com/niafrond/niafrond.github.io/compare/v1.196.1...v1.197.0) (2026-05-15)

### Features

* enhance stem handling and auto-suggestion functionality ([beb8ab8](https://github.com/niafrond/niafrond.github.io/commit/beb8ab87ccf5bb7b39ef8e2745b62777c1da0e90))

## [1.196.1](https://github.com/niafrond/niafrond.github.io/compare/v1.196.0...v1.196.1) (2026-05-15)

### Bug Fixes

* **dj-mix:** ok ([2f683b8](https://github.com/niafrond/niafrond.github.io/commit/2f683b8a6db8fdaf6bf2673eb6d2cba158b154f7))
* **dj-mix:** stem ([c7aba3e](https://github.com/niafrond/niafrond.github.io/commit/c7aba3e4d2e4d90a4894c328c247b0e2be5df27c))

## [1.196.0](https://github.com/niafrond/niafrond.github.io/compare/v1.195.0...v1.196.0) (2026-05-14)

### Features

* **dj-mix:** stable ([1908ba3](https://github.com/niafrond/niafrond.github.io/commit/1908ba3c9a87a76bffc2935b6a4650aa97badf12))

## [1.195.0](https://github.com/niafrond/niafrond.github.io/compare/v1.194.0...v1.195.0) (2026-05-14)

### Features

* **dj-mix:** stable ([2963d44](https://github.com/niafrond/niafrond.github.io/commit/2963d44eb4398e914c5aa1e67f380032af3efe9f))

## [1.194.0](https://github.com/niafrond/niafrond.github.io/compare/v1.193.0...v1.194.0) (2026-05-14)

### Features

* **dj-mix:** stable ([692371f](https://github.com/niafrond/niafrond.github.io/commit/692371f997b070ca1b3082f9ddca8f4a5109204e))
* **dj-mix:** stable ([1cbece7](https://github.com/niafrond/niafrond.github.io/commit/1cbece7b266b75b9c3ebaa23800a317f36bf08b5))
* **dj-mix:** stable ([b6fe4c5](https://github.com/niafrond/niafrond.github.io/commit/b6fe4c514721d529e0b71789adebd24e5a77e348))

## [1.193.0](https://github.com/niafrond/niafrond.github.io/compare/v1.192.0...v1.193.0) (2026-05-14)

### Features

* **dj-mix:** add cache fade button and functionality ([6da7922](https://github.com/niafrond/niafrond.github.io/commit/6da7922966f231274eed0c61928615ff3a89f996))

## [1.192.0](https://github.com/niafrond/niafrond.github.io/compare/v1.191.0...v1.192.0) (2026-05-14)

### Features

* **dj-mix:** retire l'utilisation de demucs ([9b1a476](https://github.com/niafrond/niafrond.github.io/commit/9b1a47658db4d572b4aa589eef4569e388b0d6e2))

### Bug Fixes

* **dj-mix:** remove remaining dead code (encodeStereoWav, decodeAsStereo44100) ([12a4131](https://github.com/niafrond/niafrond.github.io/commit/12a4131795c81f748c8b366c32f62a2e77fdb932))

## [1.191.0](https://github.com/niafrond/niafrond.github.io/compare/v1.190.1...v1.191.0) (2026-05-13)

### Features

* **dj-mix:** stable ([01419ca](https://github.com/niafrond/niafrond.github.io/commit/01419caadea8b0419e7a09d09e75b2ab4cf7d1c0))

## [1.190.1](https://github.com/niafrond/niafrond.github.io/compare/v1.190.0...v1.190.1) (2026-05-13)

### Bug Fixes

* **dj-mix:** stable ([6e491d4](https://github.com/niafrond/niafrond.github.io/commit/6e491d4237bebddc47414361f2318a5178e36bdd))

## [1.190.0](https://github.com/niafrond/niafrond.github.io/compare/v1.189.0...v1.190.0) (2026-05-13)

### Features

* **dj-mix:** handle stems ([d9d72ee](https://github.com/niafrond/niafrond.github.io/commit/d9d72ee96e1a264bb89d0c9b6fe7279c10f70856))
* **dj-mix:** handle stems ([1a92dcc](https://github.com/niafrond/niafrond.github.io/commit/1a92dccffe2c3df87f6f471739d296c6c41acc4c))
* **dj-mix:** stable ([59c819f](https://github.com/niafrond/niafrond.github.io/commit/59c819f79bb11241bace3e5070fa1df0df213f4f))

### Bug Fixes

* **dj-mix:** stable ([431524f](https://github.com/niafrond/niafrond.github.io/commit/431524f932e42cc6229b64d59d5d59ae14469164))
* **dj-mix:** stable ([2daaead](https://github.com/niafrond/niafrond.github.io/commit/2daaead043fa27c362dae4723217899be5177b0b))

## [1.189.0](https://github.com/niafrond/niafrond.github.io/compare/v1.188.0...v1.189.0) (2026-05-13)

### Features

* **dj-mix:** stable ([dd65e83](https://github.com/niafrond/niafrond.github.io/commit/dd65e839287179998c81b014a73fdede7b0185cf))
* **dj-mix:** stable ([f3cee40](https://github.com/niafrond/niafrond.github.io/commit/f3cee40584e623844caaf53d867077cbc4069e53))
* **dj-mix:** stable ([5e166e9](https://github.com/niafrond/niafrond.github.io/commit/5e166e91429a18f5c8a58da78a02a764f96d0c5d))
* **dj-mix:** stable ([04d65e2](https://github.com/niafrond/niafrond.github.io/commit/04d65e2d0109ab36e614eb651b6ee3ac08a42fd7))

### Bug Fixes

* correct unit tests for mixFeatures.js ([379a713](https://github.com/niafrond/niafrond.github.io/commit/379a713597fe34b7df74bdce5556eacbbf088610))
* **dj-mix:** stable ([72ab4de](https://github.com/niafrond/niafrond.github.io/commit/72ab4de855278c483bc5a3376524224f1e2d2ad6))

## [1.188.0](https://github.com/niafrond/niafrond.github.io/compare/v1.187.0...v1.188.0) (2026-05-12)

### Features

* **dj-mix:** stable ([83134c2](https://github.com/niafrond/niafrond.github.io/commit/83134c2f339958c44ae04fb374a66d00fb261a03))
* **dj-mix:** stable ([14557a7](https://github.com/niafrond/niafrond.github.io/commit/14557a709e3fbaa2f28bbc6468039c780c964a68))

## [1.187.0](https://github.com/niafrond/niafrond.github.io/compare/v1.186.0...v1.187.0) (2026-05-12)

### Features

* **dj-mix:** stable ([b8f7b35](https://github.com/niafrond/niafrond.github.io/commit/b8f7b35e563936422ca332a05b3e703f5e0e0a76))

### Bug Fixes

* **dj-mix:** do not create AudioContext when no effects are enabled ([df6c8b5](https://github.com/niafrond/niafrond.github.io/commit/df6c8b5bb646be1f9368008d1e4ab37920725237))

## [1.186.0](https://github.com/niafrond/niafrond.github.io/compare/v1.185.0...v1.186.0) (2026-05-12)

### Features

* dj-mix - default crossfade 12s, max 30s, cache file browsing ([eee6536](https://github.com/niafrond/niafrond.github.io/commit/eee653642410ecc1aec2f15c6756ec22d4a84d28))

## [1.185.0](https://github.com/niafrond/niafrond.github.io/compare/v1.184.0...v1.185.0) (2026-05-11)

### Features

* **dj-mix:** enhance album art display with next track preview and local result badge ([ab3251d](https://github.com/niafrond/niafrond.github.io/commit/ab3251daebbaa47057159b8c14e96dec477c086e))

## [1.184.0](https://github.com/niafrond/niafrond.github.io/compare/v1.183.0...v1.184.0) (2026-05-11)

### Features

* add DJ Mix app (Spotify crossfade player) ([b17f1a2](https://github.com/niafrond/niafrond.github.io/commit/b17f1a2b235fba47db97426a9ba772d892cd3026))
* DJ Mix – Spotify crossfade DJ player ([9ad6dd4](https://github.com/niafrond/niafrond.github.io/commit/9ad6dd417ef48be2286478748383cfd9f4533584))
* **dj-mix:** auto-play first track even if player not ready yet (pendingAutoplay) ([fb01151](https://github.com/niafrond/niafrond.github.io/commit/fb0115189e725d915276f7719070a9c098193015))
* **dj-mix:** cache client ID + redirect URI, simplify setup screen ([8839041](https://github.com/niafrond/niafrond.github.io/commit/88390413a298c6674c830175877b5ee7aa512949))
* **dj-mix:** dj mix app ([c4505a4](https://github.com/niafrond/niafrond.github.io/commit/c4505a41ce273c78abf2ba7346fe39ca977af031))
* **dj-mix:** migrate auth to PKCE + refresh token, pre-fill client ID ([1dc2835](https://github.com/niafrond/niafrond.github.io/commit/1dc28350acea9657fd0ea080b24139428f123888))
* **dj-mix:** persist queue to localStorage, restore on reconnect, clear on logout ([0aaf3f3](https://github.com/niafrond/niafrond.github.io/commit/0aaf3f3fb55f9b3ec08f7128dbfe56170d7a4527))
* **dj-mix:** show app immediately after auth + playlist picker ([82d87bd](https://github.com/niafrond/niafrond.github.io/commit/82d87bd91808d424b80252a6d6cff500ba068d53)), closes [DJPlayer#isReady](https://github.com/niafrond/DJPlayer/issues/isReady)
* **dj-mix:** three-tab layout (Mix/Playlist/Config) for mobile portrait ([376ede0](https://github.com/niafrond/niafrond.github.io/commit/376ede084c1bfba03b31dbae14a13bd5f23a60ed))
* **dj-mix:** two-level playlist nav, activateElement to fix autoplay sound ([50b5f97](https://github.com/niafrond/niafrond.github.io/commit/50b5f970efffa853c853a2676316bdce29a62ef7))

### Bug Fixes

* **dj-mix:** add logout button in playlist overlay; fix setup screen visibility ([86b3616](https://github.com/niafrond/niafrond.github.io/commit/86b3616b9d9c05ee607ef41ffd63aa01141722ee))
* **dj-mix:** add playlist scopes to Spotify auth ([262b6e0](https://github.com/niafrond/niafrond.github.io/commit/262b6e03321a018493b60b709348cd5a926757e4))
* **dj-mix:** add pure-JS SHA-256 fallback when crypto.subtle unavailable ([30b53d4](https://github.com/niafrond/niafrond.github.io/commit/30b53d4fc6b73ea01afe98b977e865a41939534c))
* **dj-mix:** disable play button until player ready event fires ([d7698c6](https://github.com/niafrond/niafrond.github.io/commit/d7698c6b4cf32766081bc10241865ea4e510fe7a))
* **dj-mix:** fallback to active deck when inactive deck reconnect fails ([2acb2f8](https://github.com/niafrond/niafrond.github.io/commit/2acb2f86512a2d4e575b5089e5570aa4b4c48fce))
* **dj-mix:** fix 401 caused by cross-origin sessionStorage loss during PKCE ([a95d8d9](https://github.com/niafrond/niafrond.github.io/commit/a95d8d965d5ec034813e238cf41eaaad531cf8d2))
* **dj-mix:** force localhost redirect URI when running on plain HTTP ([25f16a3](https://github.com/niafrond/niafrond.github.io/commit/25f16a371c231d9d691dbffaa9fb8017d595988b))
* **dj-mix:** guard reconnect listener cleanup when deck is null ([2a3e628](https://github.com/niafrond/niafrond.github.io/commit/2a3e628137029e29cc31b4629573b689fb7d1328))
* **dj-mix:** handle ?_init_pkce=1 in boot to start PKCE flow ([0a82314](https://github.com/niafrond/niafrond.github.io/commit/0a82314e71b9d7ffdd9e83f02db6e148fab36ac1))
* **dj-mix:** initialize decks sequentially with timeout and retry ([9f079f5](https://github.com/niafrond/niafrond.github.io/commit/9f079f5c98ddb744c498af5903e04430278e8570))
* **dj-mix:** keep active deck device_id updated on reconnect ([a98d6ad](https://github.com/niafrond/niafrond.github.io/commit/a98d6ad107ae70de9cf7eaac221e1ef7016febac))
* **dj-mix:** keep deck device ids with 10min TTL before reconnect ([7a31bfc](https://github.com/niafrond/niafrond.github.io/commit/7a31bfc6e3b10db2bd45335659c9e22795b923c8))
* **dj-mix:** logout returns to setup screen instead of auto-reconnecting ([64d6008](https://github.com/niafrond/niafrond.github.io/commit/64d6008f1d55be0b35eb54831b566d1cd34cc62a))
* **dj-mix:** prevent setVolume on null after destroy (crossfade + tracking guards) ([59af95f](https://github.com/niafrond/niafrond.github.io/commit/59af95f7c00f57eae65cd36dd1a391a532387375))
* **dj-mix:** reconnect and retry on Device not found during play/crossfade ([806f2aa](https://github.com/niafrond/niafrond.github.io/commit/806f2aad43b6a32c15c203a4074855203208a074))
* **dj-mix:** recover inactive deck for crossfade via reconnect or recreate ([d5bb781](https://github.com/niafrond/niafrond.github.io/commit/d5bb7818badf1c603fa4497af17a6b5e81daf1de))
* **dj-mix:** remove broken localhost bounce, use current origin as redirect URI ([1f3544d](https://github.com/niafrond/niafrond.github.io/commit/1f3544dcaa4eec64b4aabf836c0643fdb323c07d))
* **dj-mix:** replace deprecated market=from_token with cached user country ([a7f31e5](https://github.com/niafrond/niafrond.github.io/commit/a7f31e52f1e7b18e77165d751a7e16590b3c1f7a))
* **dj-mix:** request tracks.total via fields param; show proper count in playlist list ([e483ecb](https://github.com/niafrond/niafrond.github.io/commit/e483ecbe79fae544a6a99e5342691cc361134481))
* **dj-mix:** simplify search URL to q=&type=track&market= only ([549aa9c](https://github.com/niafrond/niafrond.github.io/commit/549aa9cdf418510935f8a46d8b40d8aa22e04fd6))
* **dj-mix:** use /playlists/{id}/items instead of deprecated /tracks endpoint ([99b59d2](https://github.com/niafrond/niafrond.github.io/commit/99b59d2cc9f6a9abb8c63a310973a2a4df982af2))
* **dj-mix:** use correct search param q= and remove invalid locale param ([04224a4](https://github.com/niafrond/niafrond.github.io/commit/04224a4117666e2c336a1f50d9948af636355ed8))
* **dj-mix:** use current origin as redirect URI instead of 127.0.0.1 ([9330c91](https://github.com/niafrond/niafrond.github.io/commit/9330c9144e715b3ab92926182a433ec9eecdfb69))
* **dj-mix:** wait for Spotify SDK before deck initialization ([a5c505e](https://github.com/niafrond/niafrond.github.io/commit/a5c505efe250f283a2d32d92d3ce7a4a311fba29))

## [1.183.0](https://github.com/niafrond/niafrond.github.io/compare/v1.182.0...v1.183.0) (2026-05-07)

### Features

* **geo-party:** auto-submit on timer end, post-validation lock, per-player status chips ([828bab1](https://github.com/niafrond/niafrond.github.io/commit/828bab1292c767fe12189386cd7a9c58700cf108))
* **geo-party:** fix panorama retry + add unit tests ([c8315a2](https://github.com/niafrond/niafrond.github.io/commit/c8315a275e7e3638f381d9800ccdfd2240c4a326))

## [1.182.0](https://github.com/niafrond/niafrond.github.io/compare/v1.181.0...v1.182.0) (2026-05-06)

### Features

* **geo-party:** only accept viable panoramas, preload in lobby, desktop layout ([9201b9a](https://github.com/niafrond/niafrond.github.io/commit/9201b9a9449feb8c64538ed788b2aa0ad0029c61))

## [1.181.0](https://github.com/niafrond/niafrond.github.io/compare/v1.180.0...v1.181.0) (2026-05-06)

### Features

* **geo-party:** add GeoGuessr-style multiplayer party game ([f6e646f](https://github.com/niafrond/niafrond.github.io/commit/f6e646f1cd096b215cfea99fcaebb67094629f80))
* **geo-party:** hardcode default Mapillary token so no setup required ([33f8ebf](https://github.com/niafrond/niafrond.github.io/commit/33f8ebfb56d4a8b7011d326239ccbc58ff950ffb))
* **geo-party:** hide Mapillary token card from setup UI ([539afd1](https://github.com/niafrond/niafrond.github.io/commit/539afd19a013c0c885a798fc5d0bdf2d6af02b88))
* **geo-party:** replace static photos with Mapillary interactive 360° Street View ([c31c575](https://github.com/niafrond/niafrond.github.io/commit/c31c575838935f727cf80587999050fdd28fdea3))

### Bug Fixes

* **geo-party:** require 2+ players to start, add decay constant, fix location name spelling ([b4925ba](https://github.com/niafrond/niafrond.github.io/commit/b4925ba890de218960f2034dc54d3422d61d30ae))

## [1.180.0](https://github.com/niafrond/niafrond.github.io/compare/v1.179.0...v1.180.0) (2026-05-05)

### Features

* **pyramide:** extend child mode to R3, R4 and Final sets ([cd1d6bc](https://github.com/niafrond/niafrond.github.io/commit/cd1d6bc69dad071c1a1ed1bc32a9fbcf81217438))

## [1.179.0](https://github.com/niafrond/niafrond.github.io/compare/v1.178.0...v1.179.0) (2026-05-05)

### Features

* **pyramide:** add child/adult/mix game mode for round 1 phrases ([0c28bdc](https://github.com/niafrond/niafrond.github.io/commit/0c28bdc312d179e6ad0c7dfb9961378e2b94e3ef))

## [1.178.0](https://github.com/niafrond/niafrond.github.io/compare/v1.177.6...v1.178.0) (2026-05-05)

### Features

* **pyramide:** avoid repeating words across games using localStorage history ([8dbc0ff](https://github.com/niafrond/niafrond.github.io/commit/8dbc0ff8918f854caea0acf98059b8b796721d3c))

## [1.177.6](https://github.com/niafrond/niafrond.github.io/compare/v1.177.5...v1.177.6) (2026-05-05)

### Bug Fixes

* **pyramide:** manche 1 affiche la reponse comme mot mystere et non le theme ([9960d11](https://github.com/niafrond/niafrond.github.io/commit/9960d118e27d8bd90ae915445d7f9312f1ff07fa))

## [1.177.5](https://github.com/niafrond/niafrond.github.io/compare/v1.177.4...v1.177.5) (2026-05-05)

### Bug Fixes

* add iceCandidatePoolSize + _tryInitialConnect retry to all peer.js files ([7ae70b5](https://github.com/niafrond/niafrond.github.io/commit/7ae70b5790df38adfa742af20c025d5a54fd6fe2))
* add STUN/TURN ICE config to taboo, quiz and blind-test peer.js for same-network WebRTC ([7f600a1](https://github.com/niafrond/niafrond.github.io/commit/7f600a1ebecf2e1c18e71da820f7cbdbd15e5e43))

## [1.177.4](https://github.com/niafrond/niafrond.github.io/compare/v1.177.3...v1.177.4) (2026-05-05)

### Bug Fixes

* auto-install Playwright chromium browser via postinstall ([41da2c2](https://github.com/niafrond/niafrond.github.io/commit/41da2c22bdb976dd7f47103741fd47eca0d3039a))

## [1.177.3](https://github.com/niafrond/niafrond.github.io/compare/v1.177.2...v1.177.3) (2026-05-05)

### Bug Fixes

* **scrum-poker:** retry initial connection for VPN users ([b29d166](https://github.com/niafrond/niafrond.github.io/commit/b29d166f8d77ed04a4a70f3b2529d61bdc9ebb5b))

## [1.177.2](https://github.com/niafrond/niafrond.github.io/compare/v1.177.1...v1.177.2) (2026-05-05)

### Bug Fixes

* **scrum-poker:** add TURN servers so WebRTC works behind a VPN ([7fd4f75](https://github.com/niafrond/niafrond.github.io/commit/7fd4f753421be071b983c573b92f0e9a9c5ca71b))

## [1.177.1](https://github.com/niafrond/niafrond.github.io/compare/v1.177.0...v1.177.1) (2026-05-05)

### Bug Fixes

* syntax error in pyramide/main.js - comment swallowed btn-r1-pass-done listener ([d0c0dde](https://github.com/niafrond/niafrond.github.io/commit/d0c0dde44b221cc523df690cb4765d7a064b79c9))

## [1.177.0](https://github.com/niafrond/niafrond.github.io/compare/v1.176.1...v1.177.0) (2026-05-04)

### Features

* **blind-test:** start audio playback at midpoint of video ([c384c81](https://github.com/niafrond/niafrond.github.io/commit/c384c81d082f257ced86dc948f50053d1b0dd5cf))
* initial implementation of Taboo game with state management, UI, and service worker ([6cf85c9](https://github.com/niafrond/niafrond.github.io/commit/6cf85c9dfce21fd5e12abc0e37b8d892bf8324fd))
* **pyramide:** extract word data to data.js, add mots folder word lists ([0057347](https://github.com/niafrond/niafrond.github.io/commit/005734700fe6d3bf53302be88cac842cf96970f7))
* **pyramide:** implement full game — R1 phrase-select, link phase, pyramid visualization, best-team Final ([4e8ca4d](https://github.com/niafrond/niafrond.github.io/commit/4e8ca4d6ee4677624cd4c93f8a0bad94cde06698))
* **pyramide:** R1 affiche le thème à la sélection, phrase à trous pendant le jeu ([5113ff2](https://github.com/niafrond/niafrond.github.io/commit/5113ff2c0e09ceb10484de9cde9511c903d3ff1b))
* **pyramide:** R1 lien — flux en 3 étapes (passer tel, lire phrase, valider) ([23c3cb7](https://github.com/niafrond/niafrond.github.io/commit/23c3cb75be8bdd67e72d67d6d07a6ede3b440f54))
* **pyramide:** R1 phrase à trous — révèle les mots au fil de la partie ([ea80f5a](https://github.com/niafrond/niafrond.github.io/commit/ea80f5a6f74e4d757a29fd00d6c97b87abec350f))
* **pyramide:** R2 cache la phrase, teinte l'écran en couleur de l'équipe ([6b3387a](https://github.com/niafrond/niafrond.github.io/commit/6b3387a48030395f687276460481d6468b34d3c5))
* **pyramide:** R3 confirm button + R4 word count + expanded data ([35e8592](https://github.com/niafrond/niafrond.github.io/commit/35e85926b7e102346b076aa6beee639feb123701)), closes [#timer-word-count](https://github.com/niafrond/niafrond.github.io/issues/timer-word-count)
* update version numbers and build dates across multiple files ([95decec](https://github.com/niafrond/niafrond.github.io/commit/95decec195e4b5017dd76fb0f268e0d99257c524))

### Bug Fixes

* **pyramide:** manche 5 - bouton Passer au lieu de Raté, JACKPOT annulé si skip ([4c12310](https://github.com/niafrond/niafrond.github.io/commit/4c123101c1d382161c33afbccf5f7e6531cd3582))
* **pyramide:** R3 cache les mises après résolution, R4 compteur en haut ([71c9e50](https://github.com/niafrond/niafrond.github.io/commit/71c9e50b7a73338063171a70eb1892e53119c6b8))
* **taboo:** prevent XSS vulnerabilities in team name rendering ([7a5d9e5](https://github.com/niafrond/niafrond.github.io/commit/7a5d9e50bb8fe636667b24c1ed2268f2fd721ea7))

## [1.176.1](https://github.com/niafrond/niafrond.github.io/compare/v1.176.0...v1.176.1) (2026-05-03)

### Bug Fixes

* add screen-pre-round and screen-turn-end to GAMEPLAY_SCREENS for landscape mode ([f45c886](https://github.com/niafrond/niafrond.github.io/commit/f45c886b6e6d330a5ce78ab65ad62e6fc3186785))

## [1.176.0](https://github.com/niafrond/niafrond.github.io/compare/v1.175.0...v1.176.0) (2026-05-03)

### Features

* Add Pyramide TV game implementation ([9eebbfb](https://github.com/niafrond/niafrond.github.io/commit/9eebbfbbd0580aaec1ddd2a98c077fb7e80975f4))

## [1.175.0](https://github.com/niafrond/niafrond.github.io/compare/v1.174.0...v1.175.0) (2026-05-03)

### Features

* **pyramide:** afficher la pyramide visuelle en Manche 4 ([ed86447](https://github.com/niafrond/niafrond.github.io/commit/ed8644707b87f2e7011a94eb6f587e5199bdf9b0))

## [1.174.0](https://github.com/niafrond/niafrond.github.io/compare/v1.173.0...v1.174.0) (2026-05-03)

### Features

* **pyramide:** enforce portrait mode ([0b8ee2c](https://github.com/niafrond/niafrond.github.io/commit/0b8ee2c274f9e792d32f207bf4af33a5ee4c0543))

## [1.173.0](https://github.com/niafrond/niafrond.github.io/compare/v1.172.0...v1.173.0) (2026-05-03)

### Features

* implement Pyramide party game based on game-template ([e0826fb](https://github.com/niafrond/niafrond.github.io/commit/e0826fbc1adad63bd832060e3b60d4f77c2c44ec))

### Bug Fixes

* correct English word 'submarine' to French 'sous-marin' in word list ([a690536](https://github.com/niafrond/niafrond.github.io/commit/a690536a0336a67b89875be5bcc14450e09b33e1))

## [1.172.0](https://github.com/niafrond/niafrond.github.io/compare/v1.171.0...v1.172.0) (2026-05-03)

### Features

* add game-template based on flash-guess architecture ([dc72365](https://github.com/niafrond/niafrond.github.io/commit/dc72365d7fe3a33b2b101491f9f8517b2bf74508))

## [1.171.0](https://github.com/niafrond/niafrond.github.io/compare/v1.170.1...v1.171.0) (2026-05-02)

### Features

* **pyramide:** meilleure visibilité du timer ([ea04e2a](https://github.com/niafrond/niafrond.github.io/commit/ea04e2af6c44bf65c1dd6cffef991aafa8790abd))

## [1.170.1](https://github.com/niafrond/niafrond.github.io/compare/v1.170.0...v1.170.1) (2026-05-02)

### Bug Fixes

* **pyramide:** refresh words at each new turn in enigmes & contrelamontre modes ([35ab49c](https://github.com/niafrond/niafrond.github.io/commit/35ab49c3953617c714482234ddfdd97c9335d7d1))

## [1.170.0](https://github.com/niafrond/niafrond.github.io/compare/v1.169.2...v1.170.0) (2026-05-02)

### Features

* **pyramide:** add mini pyramid visual & fix word count confusion in partie complète ([9c3c493](https://github.com/niafrond/niafrond.github.io/commit/9c3c4930752934b20e7777d1d6feb30c661ed0df))

## [1.169.2](https://github.com/niafrond/niafrond.github.io/compare/v1.169.1...v1.169.2) (2026-05-02)

### Bug Fixes

* pyramide - convert btn-start-game from FAB to full-width button ([6b80edb](https://github.com/niafrond/niafrond.github.io/commit/6b80edbb4530aac5f1f353d62fd684f18323dfcb))

## [1.169.1](https://github.com/niafrond/niafrond.github.io/compare/v1.169.0...v1.169.1) (2026-05-02)

### Bug Fixes

* pyramide libre - don't end game immediately when pyramid is completed on first turn ([203d4b3](https://github.com/niafrond/niafrond.github.io/commit/203d4b3ab06bbe50181bf6cd9adc7bdd2df887bf))

## [1.169.0](https://github.com/niafrond/niafrond.github.io/compare/v1.168.1...v1.169.0) (2026-05-02)

### Features

* **pyramide:** ajouter rappel orateur sur screen-pre-round et règles mode-spécifiques sur screen-pre-turn ([e68b41a](https://github.com/niafrond/niafrond.github.io/commit/e68b41afdcfd14bfab7267712ab44420a8195488))

### Bug Fixes

* **pyramide:** null-check pre-turn-mode-rule, vider le span par défaut ([e690d70](https://github.com/niafrond/niafrond.github.io/commit/e690d7009136b9b6e774316a6defc0a1b4fa8990))

## [1.168.1](https://github.com/niafrond/niafrond.github.io/compare/v1.168.0...v1.168.1) (2026-05-02)

### Bug Fixes

* **pyramide:** fix SyntaxError from unescaped apostrophe in l'ordre string literal ([00f83c8](https://github.com/niafrond/niafrond.github.io/commit/00f83c8981eba228142800e5ee7494c30721945b))
* **pyramide:** simplify mode-desc string to use regular space ([bb623d1](https://github.com/niafrond/niafrond.github.io/commit/bb623d15c24a0b44095409a915f9833c1be53b4b))

## [1.168.0](https://github.com/niafrond/niafrond.github.io/compare/v1.167.0...v1.168.0) (2026-05-02)

### Features

* **pyramide:** partie complète - manche selection is now optional ([80e3d9e](https://github.com/niafrond/niafrond.github.io/commit/80e3d9e38c31d60d117410a4590b13ae78cf93cd))

## [1.167.0](https://github.com/niafrond/niafrond.github.io/compare/v1.166.0...v1.167.0) (2026-05-02)

### Features

* **pyramide:** redesign home page UI to match flash-guess style ([135107d](https://github.com/niafrond/niafrond.github.io/commit/135107d7192c7598bfe46d996154a1b96de93ffb))

## [1.166.0](https://github.com/niafrond/niafrond.github.io/compare/v1.165.0...v1.166.0) (2026-05-02)

### Features

* **pyramide:** add bottom nav, settings/leaderboard screens, pre-round rules, manche chaining ([fb722fc](https://github.com/niafrond/niafrond.github.io/commit/fb722fc218cb005947b9640df3cc2876abb1e516))
* **pyramide:** add pwa/apk, kids mode, history nav, rotate overlay, SW deferred reload ([d54860a](https://github.com/niafrond/niafrond.github.io/commit/d54860a7087b26180c50f7136870da94f5519a97))

## [1.165.0](https://github.com/niafrond/niafrond.github.io/compare/v1.164.0...v1.165.0) (2026-05-02)

### Features

* implement Pyramide game manches (Énigmes, Contre-la-montre, Noms propres, Grande Pyramide) ([5032bb7](https://github.com/niafrond/niafrond.github.io/commit/5032bb782120cb1ff3b336ea14ca29a75f03b73c))

### Bug Fixes

* address code review feedback (hint text, NP scoring constants, dots logic clarity) ([2f230de](https://github.com/niafrond/niafrond.github.io/commit/2f230de23b05c288316bdcc3a52b4c3a7b68f960))

## [1.164.0](https://github.com/niafrond/niafrond.github.io/compare/v1.163.0...v1.164.0) (2026-05-01)

### Features

* **pyramide:** persist player list and scores in localStorage ([2002eeb](https://github.com/niafrond/niafrond.github.io/commit/2002eeb00d34b55f6ad9e5378656b17407947d89))

## [1.163.0](https://github.com/niafrond/niafrond.github.io/compare/v1.162.0...v1.163.0) (2026-05-01)

### Features

* add Pyramide game (5-level word guessing game) ([c2fbd40](https://github.com/niafrond/niafrond.github.io/commit/c2fbd40d36c16c5348a305cd685765b34785f056))

### Bug Fixes

* remove duplicate words, fix typo and sw.js comment ([71e0a01](https://github.com/niafrond/niafrond.github.io/commit/71e0a0163e67e501065f34a219cb5224f4f1bc85))

## [1.162.0](https://github.com/niafrond/niafrond.github.io/compare/v1.161.0...v1.162.0) (2026-04-30)

### Features

* add Scrum Poker P2P app + clean up README ([d8ce1c9](https://github.com/niafrond/niafrond.github.io/commit/d8ce1c92992931375ce1b794cb8e5cbdad7b5d95))

### Bug Fixes

* address code review — remove deprecated execCommand, simplify border-radius ([2789939](https://github.com/niafrond/niafrond.github.io/commit/278993958a6a634c1687e8dd61e87a3486e09443))

## [1.161.0](https://github.com/niafrond/niafrond.github.io/compare/v1.160.0...v1.161.0) (2026-04-30)

### Features

* clean up index.html - remove QR scanner and Times Up, reorder cards ([ed157ba](https://github.com/niafrond/niafrond.github.io/commit/ed157ba7cc5fd9003ece0062243d2fa86966ad31))

## [1.160.0](https://github.com/niafrond/niafrond.github.io/compare/v1.159.1...v1.160.0) (2026-04-29)

### Features

* per-item deletion for leaderboard entries and registered players ([db8fdec](https://github.com/niafrond/niafrond.github.io/commit/db8fdecffb5de3d0664f0a0d1359eed3b573244b))

## [1.159.1](https://github.com/niafrond/niafrond.github.io/compare/v1.159.0...v1.159.1) (2026-04-29)

### Bug Fixes

* resolve YAML syntax error in apk.yml line 78 ([4f259b9](https://github.com/niafrond/niafrond.github.io/commit/4f259b9eaa4c69562d9a3e9606e4bf948d472ee0))

## [1.159.0](https://github.com/niafrond/niafrond.github.io/compare/v1.158.0...v1.159.0) (2026-04-29)

### Features

* **apk:** in-app update check with background download and install ([f40bfc9](https://github.com/niafrond/niafrond.github.io/commit/f40bfc92e7cfad36ed2b9818e2eb4d19a5d5fb6d))

### Bug Fixes

* **apk:** address code review - localStorage, logging, robust XML patching ([594b740](https://github.com/niafrond/niafrond.github.io/commit/594b7404e6f67a536e475a1ac1c5c36f67fdd3eb))
* **ci:** copy ApkUpdaterPlugin.java + file_paths.xml in ci.yml ([e641040](https://github.com/niafrond/niafrond.github.io/commit/e641040b5db132fded5bce9e5c3f37e8ea98f8ab))

## [1.158.0](https://github.com/niafrond/niafrond.github.io/compare/v1.157.0...v1.158.0) (2026-04-29)

### Features

* **flash-guess:** reconnaître le préfixe d'un groupe lors de l'ajout d'un joueur ([e807fb4](https://github.com/niafrond/niafrond.github.io/commit/e807fb49abefc6b8d174cd63bc9bf0fb64169964))
* **flash-guess:** reconnaître un nom de groupe lors de l'ajout d'un joueur ([90f49e1](https://github.com/niafrond/niafrond.github.io/commit/90f49e11510c4d955888c25fa55bc5566feb2416))

## [1.157.0](https://github.com/niafrond/niafrond.github.io/compare/v1.156.0...v1.157.0) (2026-04-29)

### Features

* redesign player add UX with quick-add input, 3-dot menu and suggestions dropdown ([daf3f6b](https://github.com/niafrond/niafrond.github.io/commit/daf3f6bca6bb3ebb1df25cd595004e7ebad08653))

### Bug Fixes

* correct child status preservation in player rename, tighten player count test assertion ([43a8568](https://github.com/niafrond/niafrond.github.io/commit/43a8568f38c13f661667fe3234768d48aac3b228))

## [1.156.0](https://github.com/niafrond/niafrond.github.io/compare/v1.155.3...v1.156.0) (2026-04-29)

### Features

* **flash-guess:** améliore l'UI/UX globale ([135a707](https://github.com/niafrond/niafrond.github.io/commit/135a7070f4181dd96ea3336bc9d80771bbdd961f))

### Bug Fixes

* address code review - centralize vibrate helper, improve comments ([d6e2e30](https://github.com/niafrond/niafrond.github.io/commit/d6e2e30c8c25c516f9e97e6bbde50eac133786d6))
* prevent word descender clipping when J'ai lu button appears in kids mode ([472b454](https://github.com/niafrond/niafrond.github.io/commit/472b454bbbb4617201231ac1cb2c659669327506))

## [1.155.3](https://github.com/niafrond/niafrond.github.io/compare/v1.155.2...v1.155.3) (2026-04-28)

### Bug Fixes

* toggleKidsMode — garde trop large bloquait le bouton Mode Enfant ([f285074](https://github.com/niafrond/niafrond.github.io/commit/f285074f81d76f838c2744a40b37384d21bf31cd))

## [1.155.2](https://github.com/niafrond/niafrond.github.io/compare/v1.155.1...v1.155.2) (2026-04-28)

### Bug Fixes

* affiche le meilleur score (pas la somme) pour chaque joueur enregistré ([5f2954d](https://github.com/niafrond/niafrond.github.io/commit/5f2954dd87fe7d55d3a3d41d438301f620877057))
* remove stale totalPts fallback in member display ([7725894](https://github.com/niafrond/niafrond.github.io/commit/772589484880a80a38529692a0c18b97d495d930))

## [1.155.1](https://github.com/niafrond/niafrond.github.io/compare/v1.155.0...v1.155.1) (2026-04-28)

### Bug Fixes

* reduce turn-round-badge zone width in flash-guess ([cbcb2a7](https://github.com/niafrond/niafrond.github.io/commit/cbcb2a75e2a08899f21e6c7adc27e1c65562c19f))

## [1.155.0](https://github.com/niafrond/niafrond.github.io/compare/v1.154.1...v1.155.0) (2026-04-28)

### Features

* **flash-guess:** first-launch modal + rename tutoriel/fausse partie ([dfbaf67](https://github.com/niafrond/niafrond.github.io/commit/dfbaf6756d80ec1915d9474bafa6348204df26e7))

### Bug Fixes

* **tests:** dismiss first-launch overlay via evaluate to avoid consuming pointerdown listener ([069c84e](https://github.com/niafrond/niafrond.github.io/commit/069c84e3f449f68aea763e73cd05bbdb718cb4c9))

## [1.154.1](https://github.com/niafrond/niafrond.github.io/compare/v1.154.0...v1.154.1) (2026-04-28)

### Bug Fixes

* **tts:** fix TTS in APK (Capacitor) mode — use single utterance on Android WebView ([97d7ff1](https://github.com/niafrond/niafrond.github.io/commit/97d7ff14fb571aae2e761b0df0bef4087417eadc))

## [1.154.0](https://github.com/niafrond/niafrond.github.io/compare/v1.153.0...v1.154.0) (2026-04-28)

### Features

* **flash-guess:** améliore l'UX du menu d'ajout de joueur ([10450c0](https://github.com/niafrond/niafrond.github.io/commit/10450c03a4c84eee84e39913a1864af872602886))

### Bug Fixes

* **flash-guess:** pluralisation française et vérification groupes par données ([e00cf17](https://github.com/niafrond/niafrond.github.io/commit/e00cf177105eeda6d143c222e8124f46158b9a29))

## [1.153.0](https://github.com/niafrond/niafrond.github.io/compare/v1.152.2...v1.153.0) (2026-04-28)

### Features

* transform floating fullscreen/night/mute buttons into normal UI buttons in setup header ([0eba950](https://github.com/niafrond/niafrond.github.io/commit/0eba950eb8e4ca2fc1ec9d337966a1d02d7e27c6))

## [1.152.2](https://github.com/niafrond/niafrond.github.io/compare/v1.152.1...v1.152.2) (2026-04-28)

### Bug Fixes

* play abandon sound instead of MP3 when turn ends on fault/skip ([d97764c](https://github.com/niafrond/niafrond.github.io/commit/d97764cc7bc21765c2c0a2f711ff8b009c935aad))

## [1.152.1](https://github.com/niafrond/niafrond.github.io/compare/v1.152.0...v1.152.1) (2026-04-28)

### Bug Fixes

* re-apply immersive fullscreen on focus/resume in MainActivity ([8f87585](https://github.com/niafrond/niafrond.github.io/commit/8f87585f6bd224f4f517f7754b43076612e0e341))

## [1.152.0](https://github.com/niafrond/niafrond.github.io/compare/v1.151.0...v1.152.0) (2026-04-28)

### Features

* **flash-guess:** add missing game sounds (allWordsFound, draft, corriger, turn-end, button clicks) ([a1f8507](https://github.com/niafrond/niafrond.github.io/commit/a1f8507febc355b58f881f5e1210a27773f28395))

## [1.151.0](https://github.com/niafrond/niafrond.github.io/compare/v1.150.0...v1.151.0) (2026-04-28)

### Features

* **android:** fullscreen immersive native APK for Flash Guess ([2cf74ee](https://github.com/niafrond/niafrond.github.io/commit/2cf74eefb6f06edb8f0de067e92d3d5f4dac54df))

## [1.150.0](https://github.com/niafrond/niafrond.github.io/compare/v1.149.0...v1.150.0) (2026-04-28)

### Features

* **flash-guess:** distinct sounds for each gameplay button ([fc92874](https://github.com/niafrond/niafrond.github.io/commit/fc92874eccb147f17b1e61ea965c290a09feeb0f))

## [1.149.0](https://github.com/niafrond/niafrond.github.io/compare/v1.148.0...v1.149.0) (2026-04-28)

### Features

* afficher les noms des guessers durant le tour ([5914963](https://github.com/niafrond/niafrond.github.io/commit/5914963fb9e744465a1f3cebdc79a8edc6a9df33))

## [1.148.0](https://github.com/niafrond/niafrond.github.io/compare/v1.147.0...v1.148.0) (2026-04-28)

### Features

* affiche mots restants et score sur l'écran pré-tour (Flash Guess) ([cafd388](https://github.com/niafrond/niafrond.github.io/commit/cafd38837eff2ad6097fabbf6c4e6b1bfbf74d88))

## [1.147.0](https://github.com/niafrond/niafrond.github.io/compare/v1.146.1...v1.147.0) (2026-04-28)

### Features

* affiche les paramètres de partie sur l'écran des équipes avec possibilité de les modifier ([a2c1a2d](https://github.com/niafrond/niafrond.github.io/commit/a2c1a2d37d1b7808c27120587b7d3b4def52b6ba))

### Bug Fixes

* use this.value in turn duration handler to avoid redundant DOM query ([693d00f](https://github.com/niafrond/niafrond.github.io/commit/693d00f14e161e6ef1a8d88c48b7689cf465b281))

## [1.146.1](https://github.com/niafrond/niafrond.github.io/compare/v1.146.0...v1.146.1) (2026-04-28)

### Bug Fixes

* pressing native back button in gameplay goes to screen-setup instead of blocking ([0dbd119](https://github.com/niafrond/niafrond.github.io/commit/0dbd119095b489353dacd53e6bf60cf8096bfcd2))
* use shared closeGameSafe with cooldown for both back button and close button ([c5abcc0](https://github.com/niafrond/niafrond.github.io/commit/c5abcc02a7e86e228a67c82ef99f4cb94049c264))

## [1.146.0](https://github.com/niafrond/niafrond.github.io/compare/v1.145.2...v1.146.0) (2026-04-28)

### Features

* TTS flash-guess - simplify text, speed up voice, trigger on button press ([9240056](https://github.com/niafrond/niafrond.github.io/commit/9240056ff523d8bfd8948646a91d3cf8779d9634))

## [1.145.2](https://github.com/niafrond/niafrond.github.io/compare/v1.145.1...v1.145.2) (2026-04-28)

### Bug Fixes

* **flash-guess:** plein écran permanent sur APK (Capacitor WebView) ([bbdc521](https://github.com/niafrond/niafrond.github.io/commit/bbdc521a31dca1dd8cdb1f99d35268cd988464de))

## [1.145.1](https://github.com/niafrond/niafrond.github.io/compare/v1.145.0...v1.145.1) (2026-04-27)

### Bug Fixes

* **flash-guess:** prevent accidental text selection during gameplay ([1c06939](https://github.com/niafrond/niafrond.github.io/commit/1c069399b4b0931bb40ad38ba7f913df2bcd6136))

## [1.145.0](https://github.com/niafrond/niafrond.github.io/compare/v1.144.0...v1.145.0) (2026-04-27)

### Features

* **flash-guess:** add Android APK download link in settings ([d42c3d4](https://github.com/niafrond/niafrond.github.io/commit/d42c3d416bcdd43009f244fbac4e4d538100befa))

## [1.144.0](https://github.com/niafrond/niafrond.github.io/compare/v1.143.2...v1.144.0) (2026-04-27)

### Features

* **flash-guess:** persist player list to localStorage; prewarm TTS per player on add ([1261cea](https://github.com/niafrond/niafrond.github.io/commit/1261ceae0423c36bc2f3d3be113e92875bf6f29a))
* **flash-guess:** pre-warm TTS on game launch, announce guesser by voice ([fe34efa](https://github.com/niafrond/niafrond.github.io/commit/fe34efabf9534af57532659177ce95c1bf816580))
* **flash-guess:** split TTS pre-turn into chunks; pre-warm fixed phrases; localStorage registry ([d07cf2e](https://github.com/niafrond/niafrond.github.io/commit/d07cf2ed65165de5ad67bed41e0f0a88da98fa17))

## [1.143.2](https://github.com/niafrond/niafrond.github.io/compare/v1.143.1...v1.143.2) (2026-04-27)

### Bug Fixes

* word draft OK button always visible without scroll (grid layout) ([7b77ef4](https://github.com/niafrond/niafrond.github.io/commit/7b77ef46afc69bd3e8e501c245c2c71b8ff8e676))

## [1.143.1](https://github.com/niafrond/niafrond.github.io/compare/v1.143.0...v1.143.1) (2026-04-27)

### Bug Fixes

* add null guard in lockNextTurnBtn ([ecb57c0](https://github.com/niafrond/niafrond.github.io/commit/ecb57c017d221561c4601151da107de84caa00bf))
* btn-next-turn en bas en paysage + délai 1s anti-misclick après fin de tour ([2d5db92](https://github.com/niafrond/niafrond.github.io/commit/2d5db926f8753746fa0d12652c06ff967743466d))

## [1.143.0](https://github.com/niafrond/niafrond.github.io/compare/v1.142.0...v1.143.0) (2026-04-27)

### Features

* **quiz:** always show answers in animateur mode, remove reveal button ([f3bf16a](https://github.com/niafrond/niafrond.github.io/commit/f3bf16ab0403dc691e169dd48585053b102f54f6))
* **quiz:** show correct/wrong answers log to host at question end ([9ce1d35](https://github.com/niafrond/niafrond.github.io/commit/9ce1d354234b20ad41de3a0d4add12a66e1aa85c))
* **quiz:** show QCM choices at question end for animateur host ([d0c7651](https://github.com/niafrond/niafrond.github.io/commit/d0c7651ed09bcc157a3c23ffdcc8855eb131771b))

### Bug Fixes

* **quiz:** hide answer label when no question data, fix trivia comment ([fc3ac8e](https://github.com/niafrond/niafrond.github.io/commit/fc3ac8edb16bb23c104a6a9c5f6f8433f07574e9))

## [1.142.0](https://github.com/niafrond/niafrond.github.io/compare/v1.141.0...v1.142.0) (2026-04-27)

### Features

* **flash-guess:** synthèse vocale pour annoncer le joueur au pré-tour ([79789d9](https://github.com/niafrond/niafrond.github.io/commit/79789d91525c4d6dde31057b20a7c3b8a53649e9))

## [1.141.0](https://github.com/niafrond/niafrond.github.io/compare/v1.140.0...v1.141.0) (2026-04-27)

### Features

* **flash-guess:** add Île de la Réunion category (deselected by default) with Times Up Nout Pei words ([5c75452](https://github.com/niafrond/niafrond.github.io/commit/5c754524573d4d5772319e0f40906016076e4ad2))

### Bug Fixes

* **flash-guess:** fix spacing alignment in CATEGORY_LABELS for reunion entry ([3f1f58d](https://github.com/niafrond/niafrond.github.io/commit/3f1f58d656c94267bd2a4c1a36d03cbbae1451c9))

## [1.140.0](https://github.com/niafrond/niafrond.github.io/compare/v1.139.0...v1.140.0) (2026-04-27)

### Features

* **flash-guess:** add two kids toggles - activer questions enfants & activer temps de lecture ([5485576](https://github.com/niafrond/niafrond.github.io/commit/548557636a8341cf727f910f087899c443c26a28))

## [1.139.0](https://github.com/niafrond/niafrond.github.io/compare/v1.138.2...v1.139.0) (2026-04-27)

### Features

* add dark/light theme toggle to flash-guess, times-up, and landing page ([c5b5715](https://github.com/niafrond/niafrond.github.io/commit/c5b5715481c2941913b2b2037592e983040f5486))

### Bug Fixes

* restore times-up mute toggle and correct theme icon/tooltip logic in landing page ([fcab303](https://github.com/niafrond/niafrond.github.io/commit/fcab3032c11459ae832222d13e8e968e544421a9))

## [1.138.2](https://github.com/niafrond/niafrond.github.io/compare/v1.138.1...v1.138.2) (2026-04-25)

### Bug Fixes

* **flash-guess:** move bouton Suivant en bas au centre en fin de tour ([6b0dadf](https://github.com/niafrond/niafrond.github.io/commit/6b0dadf92ba1c1a2aee9542b0888af4034a543f5))

## [1.138.1](https://github.com/niafrond/niafrond.github.io/compare/v1.138.0...v1.138.1) (2026-04-24)

### Bug Fixes

* **apk:** use persistent KEYSTORE_BASE64 secret to prevent certificate conflicts on reinstall ([2147edc](https://github.com/niafrond/niafrond.github.io/commit/2147edc885e996fdb9f7832c6d9c80ca1510bd48))
* replace em dash with double hyphen in warning message ([795c0e6](https://github.com/niafrond/niafrond.github.io/commit/795c0e6cbaeabb851d37db502fb8b9815635caec))

## [1.138.0](https://github.com/niafrond/niafrond.github.io/compare/v1.137.1...v1.138.0) (2026-04-24)

### Features

* **flash-guess:** add Abandonner button for round 1 ([9dbf230](https://github.com/niafrond/niafrond.github.io/commit/9dbf230200f0a0ee2c52d7074e215bceec4419ae))

## [1.137.1](https://github.com/niafrond/niafrond.github.io/compare/v1.137.0...v1.137.1) (2026-04-24)

### Bug Fixes

* **flash-guess:** always request fullscreen on first user gesture ([e8b0521](https://github.com/niafrond/niafrond.github.io/commit/e8b052113524de25c2bce86a7d4e2938b788d505))

## [1.137.0](https://github.com/niafrond/niafrond.github.io/compare/v1.136.1...v1.137.0) (2026-04-24)

### Features

* hide fullscreen and sound buttons during gameplay screens ([ee6ef41](https://github.com/niafrond/niafrond.github.io/commit/ee6ef416388b88323b19a252cfadb898ac748e00))

## [1.136.1](https://github.com/niafrond/niafrond.github.io/compare/v1.136.0...v1.136.1) (2026-04-24)

### Bug Fixes

* bouton enfant/créer hors rectangle + 2 catégories par ligne ([abaf934](https://github.com/niafrond/niafrond.github.io/commit/abaf9349bd5e0329f17584db8c93853f30b19662))

## [1.136.0](https://github.com/niafrond/niafrond.github.io/compare/v1.135.4...v1.136.0) (2026-04-24)

### Features

* add rotating guesser toggle to les équipes page ([c30869d](https://github.com/niafrond/niafrond.github.io/commit/c30869d7015771e5749c833b557608da4f32ee77))

## [1.135.4](https://github.com/niafrond/niafrond.github.io/compare/v1.135.3...v1.135.4) (2026-04-23)

### Bug Fixes

* include all version files in semantic-release git assets ([642ee37](https://github.com/niafrond/niafrond.github.io/commit/642ee378f9773e2872d7ffb071f726f3eee7d222))

## [1.135.3](https://github.com/niafrond/niafrond.github.io/compare/v1.135.2...v1.135.3) (2026-04-23)

### Bug Fixes

* **flash-guess:** remove tri-secret header from word-draft screen, allow full width, fix refresh button overlap, add long-word font scaling ([2138de7](https://github.com/niafrond/niafrond.github.io/commit/2138de73a2caa1edaef93f9dcdc16bf7eefc607a))

## [1.135.2](https://github.com/niafrond/niafrond.github.io/compare/v1.135.1...v1.135.2) (2026-04-23)

### Bug Fixes

* hardcode CACHE in sw.js and defer SW reload after gameplay ([e7147c3](https://github.com/niafrond/niafrond.github.io/commit/e7147c3eb365b59196983bf9167f573de8511186))

## [1.135.1](https://github.com/niafrond/niafrond.github.io/compare/v1.135.0...v1.135.1) (2026-04-23)

### Bug Fixes

* **flash-guess:** agrandir draft-refresh-btn à 44×44px (WCAG touch target) ([7b12801](https://github.com/niafrond/niafrond.github.io/commit/7b12801aa5457656d01ce6bf1ab47b73fec09c41))
* **flash-guess:** agrandir le bouton rafraîchir la carte dans le tri caché ([4ddc73f](https://github.com/niafrond/niafrond.github.io/commit/4ddc73f02ba41da6443e9402691c2aff4499201a))

## [1.135.0](https://github.com/niafrond/niafrond.github.io/compare/v1.134.0...v1.135.0) (2026-04-23)

### Features

* **flash-guess:** fullscreen immersif masque barre d'état et navigation (all modes) ([bb9e234](https://github.com/niafrond/niafrond.github.io/commit/bb9e23444e2a2c7ca00c5f652248d4764e0436c6))

## [1.134.0](https://github.com/niafrond/niafrond.github.io/compare/v1.133.0...v1.134.0) (2026-04-23)

### Features

* cache-independent version strategy via module SWs importing version.js ([5800d55](https://github.com/niafrond/niafrond.github.io/commit/5800d55b38888ac60a38c33a2f18fd9a42a70891))

### Bug Fixes

* sync version files to 1.133.0 (were stuck at 126) ([950bb43](https://github.com/niafrond/niafrond.github.io/commit/950bb43f0f40d61bdef0ee107a7c752283fb7f70))

## [1.133.0](https://github.com/niafrond/niafrond.github.io/compare/v1.132.0...v1.133.0) (2026-04-23)

### Features

* add difficulty levels (Facile/Moyen/Difficile/God) for 2-player Flash Guess mode ([099c4d9](https://github.com/niafrond/niafrond.github.io/commit/099c4d924ead254e342f7d257fde13f57b21df86))

### Bug Fixes

* address code review - explicit difficulty check, clarify comments ([f7fe31e](https://github.com/niafrond/niafrond.github.io/commit/f7fe31e764ebab5eef704d682d058d54a2adde7c))

## [1.132.0](https://github.com/niafrond/niafrond.github.io/compare/v1.131.0...v1.132.0) (2026-04-23)

### Features

* **flash-guess:** move demo button out of sticky footer, make play button a FAB ([30c97c1](https://github.com/niafrond/niafrond.github.io/commit/30c97c117cc684aaa3d625449dc55849b2022036))

### Bug Fixes

* **flash-guess:** increase FAB shadow opacity for better visibility ([ee9e3a6](https://github.com/niafrond/niafrond.github.io/commit/ee9e3a64e23eff843b2604153d60f73187640063))

## [1.131.0](https://github.com/niafrond/niafrond.github.io/compare/v1.130.2...v1.131.0) (2026-04-23)

### Features

* **flash-guess:** afficher les infos mots restants/trouvés autour du nom du joueur ([f7ba979](https://github.com/niafrond/niafrond.github.io/commit/f7ba97996ab158d6a6b7a091f77a94ff8fe519ba))

## [1.130.2](https://github.com/niafrond/niafrond.github.io/compare/v1.130.1...v1.130.2) (2026-04-22)

### Bug Fixes

* **apk:** add trailing newline so read succeeds under bash -e ([4202f75](https://github.com/niafrond/niafrond.github.io/commit/4202f756be653ae37e589bf8fdcc348f757400a7))
* **apk:** install ImageMagick before icon generation step ([90b6817](https://github.com/niafrond/niafrond.github.io/commit/90b6817ccba67af1ce4703a9751b55da1bcb6d2e))
* **apk:** release build, correct icon and version from version.js ([717a70d](https://github.com/niafrond/niafrond.github.io/commit/717a70dd063526b5510716c0726726dd32832667))
* **apk:** use env var for keystore password, read version.js once ([969c811](https://github.com/niafrond/niafrond.github.io/commit/969c811cf73d68063f5567cdb36f987f4b25f5e1))
* **apk:** use if/then/fi instead of &&-shortcircuit to avoid bash -e exit ([0c546e2](https://github.com/niafrond/niafrond.github.io/commit/0c546e27717b0e3b3100bd2d287b213f78be5333))

## [1.130.1](https://github.com/niafrond/niafrond.github.io/compare/v1.130.0...v1.130.1) (2026-04-22)

### Bug Fixes

* **apk:** use --ks-key-alias and PATH-based apksigner in Sign APK step ([cdb459f](https://github.com/niafrond/niafrond.github.io/commit/cdb459f7913d530dac47794242cdf7a6dd78992d))

## [1.130.0](https://github.com/niafrond/niafrond.github.io/compare/v1.129.2...v1.130.0) (2026-04-22)

### Features

* **flash-guess:** plein écran intégral — manifest fullscreen + requestFullscreen sur tous les écrans ([62c8adf](https://github.com/niafrond/niafrond.github.io/commit/62c8adf37a47d32536706db991341b60e008b8a1))

## [1.129.2](https://github.com/niafrond/niafrond.github.io/compare/v1.129.1...v1.129.2) (2026-04-22)

### Bug Fixes

* **flash-guess:** fix APK non-interactive bug - add local version.js, leaderboard.js to SW cache ([900a7a4](https://github.com/niafrond/niafrond.github.io/commit/900a7a416f9ac8bcf64a820fb10a01a4c4c4bf43))

## [1.129.1](https://github.com/niafrond/niafrond.github.io/compare/v1.129.0...v1.129.1) (2026-04-22)

### Bug Fixes

* upgrade Java to 21 in APK build workflow ([6b66f02](https://github.com/niafrond/niafrond.github.io/commit/6b66f02c9f3a89f0dcdedaedda02cdd9a284ece5))

## [1.129.0](https://github.com/niafrond/niafrond.github.io/compare/v1.128.0...v1.129.0) (2026-04-22)

### Features

* lazy-load JSON word files per category (flash-guess) ([441b490](https://github.com/niafrond/niafrond.github.io/commit/441b49076c4b8560eee928904619db32fe2512c4))

## [1.128.0](https://github.com/niafrond/niafrond.github.io/compare/v1.127.0...v1.128.0) (2026-04-22)

### Features

* **flash-guess:** add card refresh during word draft in kids mode ([fe38488](https://github.com/niafrond/niafrond.github.io/commit/fe384889699d07066cba37f8a472f0093abcd203))

## [1.127.0](https://github.com/niafrond/niafrond.github.io/compare/v1.126.0...v1.127.0) (2026-04-22)

### Features

* affiche la version en haut à droite dans flash-guess ([9c78330](https://github.com/niafrond/niafrond.github.io/commit/9c78330aa77d1b33bd8fe546141810e8ac2e3c25))
* centralise la version dans /version.js partagé par toutes les apps ([3abd723](https://github.com/niafrond/niafrond.github.io/commit/3abd723a77e2cacf260cedb3c9f9a248a624f24d))

## [1.126.0](https://github.com/niafrond/niafrond.github.io/compare/v1.125.0...v1.126.0) (2026-04-22)

### Features

* add GitHub Actions workflow to build Flash Guess APK (Capacitor) ([32b55b1](https://github.com/niafrond/niafrond.github.io/commit/32b55b1a0fac6288faa6a1a05ba63c092ae89d18))

### Bug Fixes

* include release tag in APK filename ([bf2d3e7](https://github.com/niafrond/niafrond.github.io/commit/bf2d3e7c688b241a687fdc0ff7222fe9d42516ec))

## [1.125.0](https://github.com/niafrond/niafrond.github.io/compare/v1.124.0...v1.125.0) (2026-04-22)

### Features

* bottom nav UI redesign for Flash Guess ([39cb3ac](https://github.com/niafrond/niafrond.github.io/commit/39cb3ac444059d84544720526f56a7c0f63866e0)), closes [#7c3aed](https://github.com/niafrond/niafrond.github.io/issues/7c3aed)
* enable word draft by default ([fc1c80e](https://github.com/niafrond/niafrond.github.io/commit/fc1c80ec5d7b6125c9a8f1eaa383f334b032df78))
* **flash-guess:** add bottom nav bar, settings screen, and in-game close button ([bbc240c](https://github.com/niafrond/niafrond.github.io/commit/bbc240c4d0a5ab38a8480c1ef9b0fa947d5d8caf))

## [1.124.0](https://github.com/niafrond/niafrond.github.io/compare/v1.123.2...v1.124.0) (2026-04-22)

### Features

* migrate words to per-category JSON files + add 42 new categories ([1a367fd](https://github.com/niafrond/niafrond.github.io/commit/1a367fda1d0be43a651ea846dfa60f1a955bf96f))

## [1.123.2](https://github.com/niafrond/niafrond.github.io/compare/v1.123.1...v1.123.2) (2026-04-21)

### Bug Fixes

* **quiz:** mode animateur n'affiche plus les réponses directement ([c6da580](https://github.com/niafrond/niafrond.github.io/commit/c6da58021ad66d8ce131366ae04a3566cfbccf24))

## [1.123.1](https://github.com/niafrond/niafrond.github.io/compare/v1.123.0...v1.123.1) (2026-04-21)

### Bug Fixes

* disable buzz timer in animateur mode ([a4b84ff](https://github.com/niafrond/niafrond.github.io/commit/a4b84ff9fce711dce46e67b37a310b661f116c16))

## [1.123.0](https://github.com/niafrond/niafrond.github.io/compare/v1.122.0...v1.123.0) (2026-04-21)

### Features

* **quiz:** extend animateur mode to QCM, PINGPONG, BUZZ_QCM modes ([27a9d04](https://github.com/niafrond/niafrond.github.io/commit/27a9d04b39b650c048de1a4feb8ec2666969ce09))

## [1.122.0](https://github.com/niafrond/niafrond.github.io/compare/v1.121.0...v1.122.0) (2026-04-21)

### Features

* **quiz:** set QCM as default game mode ([6cef0f8](https://github.com/niafrond/niafrond.github.io/commit/6cef0f89c91254a6bdcfb924cbf120852fc0b203))

## [1.121.0](https://github.com/niafrond/niafrond.github.io/compare/v1.120.0...v1.121.0) (2026-04-21)

### Features

* animateur mode - add local players in lobby + select winner per question ([ea7abf8](https://github.com/niafrond/niafrond.github.io/commit/ea7abf8421451b0979becf7a9975240052611a35))

## [1.120.0](https://github.com/niafrond/niafrond.github.io/compare/v1.119.0...v1.120.0) (2026-04-21)

### Features

* **flash-guess:** redesign app icon — centered bolt, vibrant gradient, colorful accents ([862826c](https://github.com/niafrond/niafrond.github.io/commit/862826c4d166adf333d392f652dfeed6639f17da))

## [1.119.0](https://github.com/niafrond/niafrond.github.io/compare/v1.118.0...v1.119.0) (2026-04-21)

### Features

* add skip round 3 button at end of round 2 ([15b09ed](https://github.com/niafrond/niafrond.github.io/commit/15b09ed4ede9b5d4b24b04c1e6b2b9431efd2e10))

## [1.118.0](https://github.com/niafrond/niafrond.github.io/compare/v1.117.0...v1.118.0) (2026-04-21)

### Features

* **flash-guess:** mode devineur tournant pour 3/4/5/7 joueurs ([1d9a627](https://github.com/niafrond/niafrond.github.io/commit/1d9a627af1811d743c83d5b887f29394c88a0c34))

## [1.117.0](https://github.com/niafrond/niafrond.github.io/compare/v1.116.1...v1.117.0) (2026-04-21)

### Features

* add tutorial to flash-guess, similar to times-up ([161e9d1](https://github.com/niafrond/niafrond.github.io/commit/161e9d17183eda17fd39e09e7e00029b700c8865))

### Bug Fixes

* improve tutorial button description wording ([3d66b4b](https://github.com/niafrond/niafrond.github.io/commit/3d66b4b79ab6deebad47cc6b8d5a35490725d041))

## [1.116.1](https://github.com/niafrond/niafrond.github.io/compare/v1.116.0...v1.116.1) (2026-04-21)

### Bug Fixes

* **flash-guess:** word draft words overwritten by startRound(1) ([155cc29](https://github.com/niafrond/niafrond.github.io/commit/155cc298e59c0813612587bab3a254c5ef122b73))

## [1.116.0](https://github.com/niafrond/niafrond.github.io/compare/v1.115.0...v1.116.0) (2026-04-20)

### Features

* hide teams in 2-player coop mode, explain chrono/precision ([aa7cdda](https://github.com/niafrond/niafrond.github.io/commit/aa7cddaf15fecba292521a904b6cb0714aa50608))

## [1.115.0](https://github.com/niafrond/niafrond.github.io/compare/v1.114.2...v1.115.0) (2026-04-20)

### Features

* grid layout for word draft screen (tri secret) ([be64d06](https://github.com/niafrond/niafrond.github.io/commit/be64d06631313978cd4901f2de719b982ea142f5))

## [1.114.2](https://github.com/niafrond/niafrond.github.io/compare/v1.114.1...v1.114.2) (2026-04-20)

### Bug Fixes

* landscape layout for word draft (Tri secret) screen ([a09a437](https://github.com/niafrond/niafrond.github.io/commit/a09a437c08ed844ae71cd8f97b38f2bff363758a))

## [1.114.1](https://github.com/niafrond/niafrond.github.io/compare/v1.114.0...v1.114.1) (2026-04-20)

### Bug Fixes

* remove hardcoded currentTeamIdx=0 in btn-round-go handler ([ad1556b](https://github.com/niafrond/niafrond.github.io/commit/ad1556b2ad7612ce1d8efa413ae7410c84847f4c))

## [1.114.0](https://github.com/niafrond/niafrond.github.io/compare/v1.113.0...v1.114.0) (2026-04-20)

### Features

* remove poll update and force update features from all apps ([b257c08](https://github.com/niafrond/niafrond.github.io/commit/b257c08c5298c1f5f60cb0d423e25133621f9d6f))

## [1.113.0](https://github.com/niafrond/niafrond.github.io/compare/v1.112.2...v1.113.0) (2026-04-20)

### Features

* proportional child-read timer based on word length (600ms/letter, min 3s) ([a620b6b](https://github.com/niafrond/niafrond.github.io/commit/a620b6b83cb8109b5a6a5ca7454517bfdea1eaa6))
* set CHILD_READ_MS_PER_LETTER to 1420 ([6e12859](https://github.com/niafrond/niafrond.github.io/commit/6e12859184235adc38b5d5466c980cb67788e1b4))

## [1.112.2](https://github.com/niafrond/niafrond.github.io/compare/v1.112.1...v1.112.2) (2026-04-20)

### Bug Fixes

* avoid same team playing first in consecutive rounds (hors coop) ([dc6f0f4](https://github.com/niafrond/niafrond.github.io/commit/dc6f0f4b2b9892eca7b56ff094992166a3ca022e))

## [1.112.1](https://github.com/niafrond/niafrond.github.io/compare/v1.112.0...v1.112.1) (2026-04-20)

### Bug Fixes

* pass reloadFn to createUpdateBanner to fix reload button ([1a38e2b](https://github.com/niafrond/niafrond.github.io/commit/1a38e2bd92105d28f09e26fc9bf872607a2d869d))

## [1.112.0](https://github.com/niafrond/niafrond.github.io/compare/v1.111.0...v1.112.0) (2026-04-20)

### Features

* force landscape orientation for word draft screen ([07013e0](https://github.com/niafrond/niafrond.github.io/commit/07013e097ed2473140a4c4c71de87a4f025607c4))
* remove categories from word draft screen and maximize word size without scroll ([a23cca4](https://github.com/niafrond/niafrond.github.io/commit/a23cca4bdf24caf373f502abe26360cf60152536))

## [1.111.0](https://github.com/niafrond/niafrond.github.io/compare/v1.110.1...v1.111.0) (2026-04-20)

### Features

* hide category/kids-badge in game, show current player name in turn header ([2f33f58](https://github.com/niafrond/niafrond.github.io/commit/2f33f58ba9aa47ec62d9d00b8983b702ccefe305))

## [1.110.1](https://github.com/niafrond/niafrond.github.io/compare/v1.110.0...v1.110.1) (2026-04-20)

### Bug Fixes

* reload button in update banner triggers forceUpdate (clears SW + cache) ([88efe40](https://github.com/niafrond/niafrond.github.io/commit/88efe4059aaa5ec6a9b60defd2dea84267378a38))

## [1.110.0](https://github.com/niafrond/niafrond.github.io/compare/v1.109.1...v1.110.0) (2026-04-20)

### Features

* add leaderboard tab with standard and 2-player coop rankings ([0ad3e1a](https://github.com/niafrond/niafrond.github.io/commit/0ad3e1ad451e09df316781e3d6e933bf91371d3a))

## [1.109.1](https://github.com/niafrond/niafrond.github.io/compare/v1.109.0...v1.109.1) (2026-04-20)

### Bug Fixes

* filter only kidFriendly words in kids mode and update tests ([73784f4](https://github.com/niafrond/niafrond.github.io/commit/73784f416061a415ab18e07f217b4dd832a611c9))

## [1.109.0](https://github.com/niafrond/niafrond.github.io/compare/v1.108.0...v1.109.0) (2026-04-20)

### Features

* suppress update notification and auto-reload during gameplay ([10a12ce](https://github.com/niafrond/niafrond.github.io/commit/10a12ce7f95816fa07cb82af172b56db0dc10e35))

## [1.108.0](https://github.com/niafrond/niafrond.github.io/compare/v1.107.0...v1.108.0) (2026-04-20)

### Features

* **flash-guess:** clarify visually that the top block is for adding players ([8858df4](https://github.com/niafrond/niafrond.github.io/commit/8858df4624a3c3eaa65fbe393ad8c9da9142f555))

## [1.107.0](https://github.com/niafrond/niafrond.github.io/compare/v1.106.1...v1.107.0) (2026-04-20)

### Features

* **flash-guess:** add cooperative 2-player objective mode (time or turns) ([100e9d1](https://github.com/niafrond/niafrond.github.io/commit/100e9d1efdc12f07407b88a4f6abc03b5b53b0e2))
* **flash-guess:** coop mode — multi-select chrono+precision, remove classic option ([30e2b7c](https://github.com/niafrond/niafrond.github.io/commit/30e2b7ced23a40b8fddd884c31b336f77b6f9c55))

### Bug Fixes

* **flash-guess:** formatCoopTime omits 0s and fix turn pluralization ([23cefb0](https://github.com/niafrond/niafrond.github.io/commit/23cefb06823d46e88c4db4c8bddd3c4c3fa54b93))

## [1.106.1](https://github.com/niafrond/niafrond.github.io/compare/v1.106.0...v1.106.1) (2026-04-20)

### Bug Fixes

* **demo:** unfreeze child-read button only after tip 4 (btn-found) ([608521b](https://github.com/niafrond/niafrond.github.io/commit/608521b882c5d42ff8bdd756b902c07be8287e62))

## [1.106.0](https://github.com/niafrond/niafrond.github.io/compare/v1.105.0...v1.106.0) (2026-04-20)

### Features

* implement word draft (tri caché) option for flash-guess ([4059337](https://github.com/niafrond/niafrond.github.io/commit/405933707db0e96aaaa9471b801515d8e9c58991))

## [1.105.0](https://github.com/niafrond/niafrond.github.io/compare/v1.104.0...v1.105.0) (2026-04-20)

### Features

* **flash-guess:** visually clarify player section on setup screen ([3afbca6](https://github.com/niafrond/niafrond.github.io/commit/3afbca66f52c4a98b3160128183db8855927654f))

## [1.104.0](https://github.com/niafrond/niafrond.github.io/compare/v1.103.1...v1.104.0) (2026-04-20)

### Features

* **flash-guess:** split btn-pass into btn-error and btn-skip stacked vertically ([7b2d4f2](https://github.com/niafrond/niafrond.github.io/commit/7b2d4f27b85aae6e0b5a0095b7ef711caeb86e05))

## [1.103.1](https://github.com/niafrond/niafrond.github.io/compare/v1.103.0...v1.103.1) (2026-04-20)

### Bug Fixes

* reduce SW update polling to once per hour ([47244fb](https://github.com/niafrond/niafrond.github.io/commit/47244fb558acbbf99dfd9f79a1f4c90fde480054))

## [1.103.0](https://github.com/niafrond/niafrond.github.io/compare/v1.102.0...v1.103.0) (2026-04-20)

### Features

* **flash-guess:** bouton retour navigateur/téléphone ([a4201e1](https://github.com/niafrond/niafrond.github.io/commit/a4201e180e0d8cf4ed075cf34836d585b4f5e013))

## [1.102.0](https://github.com/niafrond/niafrond.github.io/compare/v1.101.0...v1.102.0) (2026-04-20)

### Features

* redistribute kidFriendly words into proper categories, exclude them when kidsMode is off ([512adf1](https://github.com/niafrond/niafrond.github.io/commit/512adf1d16c7cf75a41b34b90f043b90706184ac))

### Bug Fixes

* move pyramide and château to general_knowledge per review feedback ([8bfaaaa](https://github.com/niafrond/niafrond.github.io/commit/8bfaaaaeb0a4c6f8cbb284278a5de1152fa30d9a))

## [1.101.0](https://github.com/niafrond/niafrond.github.io/compare/v1.100.0...v1.101.0) (2026-04-20)

### Features

* restructure setup screen into 3 collapsed panels (nouveau joueur, groupe, enregistré) ([d9052d2](https://github.com/niafrond/niafrond.github.io/commit/d9052d21f18927bff1ee394593daed090f988a62))

## [1.100.0](https://github.com/niafrond/niafrond.github.io/compare/v1.99.2...v1.100.0) (2026-04-20)

### Features

* replace 👶 with 🧒 in flash-guess ([0149dbe](https://github.com/niafrond/niafrond.github.io/commit/0149dbe8dd61bd9c2496d1fd99c40cea114fa60e))

## [1.99.2](https://github.com/niafrond/niafrond.github.io/compare/v1.99.1...v1.99.2) (2026-04-20)

### Bug Fixes

* uniformise emoji enfant et remplace par texte lors de l'ajout de membre ([d8f3c11](https://github.com/niafrond/niafrond.github.io/commit/d8f3c11abf6dcbe84e60fa6734f2fa37ea99527f))
* uniformise emoji enfant et remplace par texte lors de l'ajout de membre ([#154](https://github.com/niafrond/niafrond.github.io/issues/154)) ([9ed3b51](https://github.com/niafrond/niafrond.github.io/commit/9ed3b51f89eb1776a1609d0289a11b9610f3cda4))

## [1.99.1](https://github.com/niafrond/niafrond.github.io/compare/v1.99.0...v1.99.1) (2026-04-20)

### Bug Fixes

* checkout main branch on tag-triggered deploy ([#152](https://github.com/niafrond/niafrond.github.io/issues/152)) ([40d2881](https://github.com/niafrond/niafrond.github.io/commit/40d2881b506d52bf154e890caf35d9b2042179aa))

## [1.99.0](https://github.com/niafrond/niafrond.github.io/compare/v1.98.1...v1.99.0) (2026-04-20)

### Features

* **flash-guess:** use MP3 file for end-of-turn bell sound ([#151](https://github.com/niafrond/niafrond.github.io/issues/151)) ([8c8c1fe](https://github.com/niafrond/niafrond.github.io/commit/8c8c1fe72128bb9fc02c1fda14ba052826b37703))

## [1.98.1](https://github.com/niafrond/niafrond.github.io/compare/v1.98.0...v1.98.1) (2026-04-20)

### Bug Fixes

* **flash-guess:** fix corrupted speaker emoji in mute toggle ([8929dc6](https://github.com/niafrond/niafrond.github.io/commit/8929dc6a323a196b0b04d92ca87d7c52289ce0d5))

## [1.98.0](https://github.com/niafrond/niafrond.github.io/compare/v1.97.1...v1.98.0) (2026-04-20)

### Features

* **flash-guess:** démo mode enfant avec J'ai lu! figé jusqu'à ok j'ai compris ([c834385](https://github.com/niafrond/niafrond.github.io/commit/c83438558cc68bd1b408d436406972821e6a57db))

### Bug Fixes

* **flash-guess:** align demo variable assignments to match project style ([52bb241](https://github.com/niafrond/niafrond.github.io/commit/52bb241e19803912fb806af81e984e41aeb76e05))

## [1.97.1](https://github.com/niafrond/niafrond.github.io/compare/v1.97.0...v1.97.1) (2026-04-20)

### Bug Fixes

* restore playerIsChild from localStorage on replay ([#147](https://github.com/niafrond/niafrond.github.io/issues/147)) ([6e8c3a5](https://github.com/niafrond/niafrond.github.io/commit/6e8c3a52278cf8e274aac94525c046c2cf1606aa))

## [1.97.0](https://github.com/niafrond/niafrond.github.io/compare/v1.96.0...v1.97.0) (2026-04-20)

### Features

* hourly auto update checker with discreet banner on all apps ([#146](https://github.com/niafrond/niafrond.github.io/issues/146)) ([fa1eb75](https://github.com/niafrond/niafrond.github.io/commit/fa1eb75a3716c4dd125731646cdc95fdca326115))

## [1.96.0](https://github.com/niafrond/niafrond.github.io/compare/v1.95.0...v1.96.0) (2026-04-20)

### Features

* **demo:** wait for first Trouvé before explaining Annuler/Refaire/J'ai lu ([#145](https://github.com/niafrond/niafrond.github.io/issues/145)) ([697722c](https://github.com/niafrond/niafrond.github.io/commit/697722c6cba593646443366bd4154ae2771344d5))

## [1.95.0](https://github.com/niafrond/niafrond.github.io/compare/v1.94.0...v1.95.0) (2026-04-20)

### Features

* **flash-guess:** boutons annuler/refaire toujours visibles, grisés si non applicable ([#143](https://github.com/niafrond/niafrond.github.io/issues/143)) ([6879154](https://github.com/niafrond/niafrond.github.io/commit/6879154f75205f73c69345aeb8b5bdc2a30d5b1e))

## [1.94.0](https://github.com/niafrond/niafrond.github.io/compare/v1.93.1...v1.94.0) (2026-04-20)

### Features

* **flash-guess:** auto-dismiss "J'ai lu" button after 5s with color drain animation ([#142](https://github.com/niafrond/niafrond.github.io/issues/142)) ([ba89521](https://github.com/niafrond/niafrond.github.io/commit/ba89521a5bbbd1e7c39171b90bb5968c6f6079d0))

## [1.93.1](https://github.com/niafrond/niafrond.github.io/compare/v1.93.0...v1.93.1) (2026-04-20)

### Bug Fixes

* populate version badge in flash-guess ([#140](https://github.com/niafrond/niafrond.github.io/issues/140)) ([4afc03d](https://github.com/niafrond/niafrond.github.io/commit/4afc03d73a5080c2edea0f56ecfeeef9130ddebc))

## [1.93.0](https://github.com/niafrond/niafrond.github.io/compare/v1.92.0...v1.93.0) (2026-04-20)

### Features

* **flash-guess:** unflag existing words, add kid-friendly words list ([#139](https://github.com/niafrond/niafrond.github.io/issues/139)) ([ce51c94](https://github.com/niafrond/niafrond.github.io/commit/ce51c94c9d1650f1b4c6364f6c71c11fb12f6123))

## [1.92.0](https://github.com/niafrond/niafrond.github.io/compare/v1.91.0...v1.92.0) (2026-04-20)

### Features

* **flash-guess:** merge player tabs, auto-save to registry, add child toggle on member items ([#138](https://github.com/niafrond/niafrond.github.io/issues/138)) ([101ffd7](https://github.com/niafrond/niafrond.github.io/commit/101ffd75cd807a35a9651e2a67f796cd4dd75931))

## [1.91.0](https://github.com/niafrond/niafrond.github.io/compare/v1.90.0...v1.91.0) (2026-04-19)

### Features

* use 3 words in demo mode instead of 1 ([#136](https://github.com/niafrond/niafrond.github.io/issues/136)) ([b81e754](https://github.com/niafrond/niafrond.github.io/commit/b81e754e869bb7e36f71ea66469a0a42fd1ed6ea))

## [1.90.0](https://github.com/niafrond/niafrond.github.io/compare/v1.89.0...v1.90.0) (2026-04-19)

### Features

* add flash-guess game with category selection and per-category word editor ([#135](https://github.com/niafrond/niafrond.github.io/issues/135)) ([86e33e8](https://github.com/niafrond/niafrond.github.io/commit/86e33e8e0fafb2abd02a8541b424e7a03aeaefe4))

## [1.89.0](https://github.com/niafrond/niafrond.github.io/compare/v1.88.1...v1.89.0) (2026-04-19)

### Features

* **times-up:** portrait overlay hors partie + bouton Ajouter sous le champ ([#132](https://github.com/niafrond/niafrond.github.io/issues/132)) ([46f396a](https://github.com/niafrond/niafrond.github.io/commit/46f396a29d81c458d4b22da69bbfc160655d56e1))

## [1.88.1](https://github.com/niafrond/niafrond.github.io/compare/v1.88.0...v1.88.1) (2026-04-19)

### Bug Fixes

* **times-up:** allow rotation in PWA by removing portrait orientation lock ([#131](https://github.com/niafrond/niafrond.github.io/issues/131)) ([a8ecebb](https://github.com/niafrond/niafrond.github.io/commit/a8ecebb82b10b992b7c17ec4904d7c482078f169))

## [1.88.0](https://github.com/niafrond/niafrond.github.io/compare/v1.87.3...v1.88.0) (2026-04-19)

### Features

* **times-up:** demo mode explains the 'Je suis prêt !' button ([#130](https://github.com/niafrond/niafrond.github.io/issues/130)) ([5bc813b](https://github.com/niafrond/niafrond.github.io/commit/5bc813b6973890fcce55aaaabeeb0c6cbae71504))

## [1.87.3](https://github.com/niafrond/niafrond.github.io/compare/v1.87.2...v1.87.3) (2026-04-19)

### Bug Fixes

* **times-up:** default PWA orientation to portrait in manifest ([#128](https://github.com/niafrond/niafrond.github.io/issues/128)) ([bd24a13](https://github.com/niafrond/niafrond.github.io/commit/bd24a13386dd1ea0bdb2626a820f4e15db72c1e8))

## [1.87.2](https://github.com/niafrond/niafrond.github.io/compare/v1.87.1...v1.87.2) (2026-04-19)

### Bug Fixes

* **times-up:** hidden attribute ignored on .btn elements due to display:inline-flex override ([#126](https://github.com/niafrond/niafrond.github.io/issues/126)) ([fd2c47a](https://github.com/niafrond/niafrond.github.io/commit/fd2c47a46490f7dbbb66fda78b84c03895980ee2))

## [1.87.1](https://github.com/niafrond/niafrond.github.io/compare/v1.87.0...v1.87.1) (2026-04-19)

### Bug Fixes

* **times-up:** fix PWA installation mode ([#127](https://github.com/niafrond/niafrond.github.io/issues/127)) ([a927d05](https://github.com/niafrond/niafrond.github.io/commit/a927d05209392832e48c9d258da8d0a2f479d340))

## [1.87.0](https://github.com/niafrond/niafrond.github.io/compare/v1.86.0...v1.87.0) (2026-04-19)

### Features

* **times-up:** fusionner les boutons Erreur et Passer en un seul bouton ([#124](https://github.com/niafrond/niafrond.github.io/issues/124)) ([27ab2ae](https://github.com/niafrond/niafrond.github.io/commit/27ab2ae5716d90b655560f4c217a49f37d1460ac))

## [1.86.0](https://github.com/niafrond/niafrond.github.io/compare/v1.85.2...v1.86.0) (2026-04-19)

### Features

* **demo:** landscape gate, score inter-screens, undo/redo tip ([#125](https://github.com/niafrond/niafrond.github.io/issues/125)) ([ca844e5](https://github.com/niafrond/niafrond.github.io/commit/ca844e5de21e765a60e7e0b595fd85f554d1ff1d))

## [1.85.2](https://github.com/niafrond/niafrond.github.io/compare/v1.85.1...v1.85.2) (2026-04-19)

### Bug Fixes

* **times-up:** auto-invalidate cached JS on deployment via SW cache busting ([#123](https://github.com/niafrond/niafrond.github.io/issues/123)) ([0c93e3b](https://github.com/niafrond/niafrond.github.io/commit/0c93e3bb39e2fe807913b08d4dd0b329f52c9b76))

## [1.85.1](https://github.com/niafrond/niafrond.github.io/compare/v1.85.0...v1.85.1) (2026-04-19)

### Bug Fixes

* prevent scroll overflow in fullscreen mode for times-up screens ([#122](https://github.com/niafrond/niafrond.github.io/issues/122)) ([a8fd1ea](https://github.com/niafrond/niafrond.github.io/commit/a8fd1ea3eabb1d71616143b4f2455f2c42935632))

## [1.85.0](https://github.com/niafrond/niafrond.github.io/compare/v1.84.1...v1.85.0) (2026-04-19)

### Features

* **times-up:** demo mode — 3-round guided tour with spotlight tooltips ([#121](https://github.com/niafrond/niafrond.github.io/issues/121)) ([1a53445](https://github.com/niafrond/niafrond.github.io/commit/1a53445ebfa8489b3da6357a9065b4727a24d72c))

## [1.84.1](https://github.com/niafrond/niafrond.github.io/compare/v1.84.0...v1.84.1) (2026-04-19)

### Bug Fixes

* **times-up:** PWA installs as app instead of shortcut ([#120](https://github.com/niafrond/niafrond.github.io/issues/120)) ([ad653a7](https://github.com/niafrond/niafrond.github.io/commit/ad653a77926d3de1ce20e8aafe7d856c8a3d4c50))

## [1.84.0](https://github.com/niafrond/niafrond.github.io/compare/v1.83.0...v1.84.0) (2026-04-19)

### Features

* **times-up:** ajoute slide "Faux jeu" dans le tutoriel avec chrono figé et bulles d'explication ([#118](https://github.com/niafrond/niafrond.github.io/issues/118)) ([f3c10ff](https://github.com/niafrond/niafrond.github.io/commit/f3c10ff11fe67cd9e2cce401bfe465e84faa9d74))

## [1.83.0](https://github.com/niafrond/niafrond.github.io/compare/v1.82.1...v1.83.0) (2026-04-19)

### Features

* **times-up:** bouton Annuler côté timer, ajout Refaire, historique complet de manche ([#117](https://github.com/niafrond/niafrond.github.io/issues/117)) ([3a51106](https://github.com/niafrond/niafrond.github.io/commit/3a5110652ef2c59ef790851696dfbbf67d1c53e3))

## [1.82.1](https://github.com/niafrond/niafrond.github.io/compare/v1.82.0...v1.82.1) (2026-04-19)

### Bug Fixes

* corriger tuto manche 2 & 3 — orateur appuie sur Erreur, doit Passer en cas de faute ([#116](https://github.com/niafrond/niafrond.github.io/issues/116)) ([f7cec02](https://github.com/niafrond/niafrond.github.io/commit/f7cec0239aa0f85e16856a4efa07a95165844c2e))

## [1.82.0](https://github.com/niafrond/niafrond.github.io/compare/v1.81.0...v1.82.0) (2026-04-19)

### Features

* **times-up:** rend la zone règles déroulable, repliée par défaut ([#115](https://github.com/niafrond/niafrond.github.io/issues/115)) ([2ec57a9](https://github.com/niafrond/niafrond.github.io/commit/2ec57a90644cd567a1b1b232813dc5c6f06fe0bc))

## [1.81.0](https://github.com/niafrond/niafrond.github.io/compare/v1.80.0...v1.81.0) (2026-04-19)

### Features

* **times-up:** add 500ms cooldown between button clicks ([#114](https://github.com/niafrond/niafrond.github.io/issues/114)) ([eef4ce8](https://github.com/niafrond/niafrond.github.io/commit/eef4ce8ab914151db3a8eedb12cb0d81b5a92326))

## [1.80.0](https://github.com/niafrond/niafrond.github.io/compare/v1.79.0...v1.80.0) (2026-04-19)

### Features

* **times-up:** make undo button more visible during a game turn ([#112](https://github.com/niafrond/niafrond.github.io/issues/112)) ([114e3bc](https://github.com/niafrond/niafrond.github.io/commit/114e3bce6260a5c9fe8df82c762dc72cddda50f2))

## [1.79.0](https://github.com/niafrond/niafrond.github.io/compare/v1.78.0...v1.79.0) (2026-04-19)

### Features

* **times-up:** add interactive tutorial modal ([#110](https://github.com/niafrond/niafrond.github.io/issues/110)) ([f845547](https://github.com/niafrond/niafrond.github.io/commit/f8455471784eed6fab4717936b2b3cc21f9c7039))

## [1.78.0](https://github.com/niafrond/niafrond.github.io/compare/v1.77.0...v1.78.0) (2026-04-19)

### Features

* **times-up:** enable PWA installation with name Time's up ([#108](https://github.com/niafrond/niafrond.github.io/issues/108)) ([bfd7a78](https://github.com/niafrond/niafrond.github.io/commit/bfd7a780ccde3388b91629fb12f172f146d413ef))

## [1.77.0](https://github.com/niafrond/niafrond.github.io/compare/v1.76.0...v1.77.0) (2026-04-19)

### Features

* **times-up:** highlight player names in pre-turn screen ([#107](https://github.com/niafrond/niafrond.github.io/issues/107)) ([c679d06](https://github.com/niafrond/niafrond.github.io/commit/c679d06ea665edc4da029267a652e821f1ef2225))

## [1.76.0](https://github.com/niafrond/niafrond.github.io/compare/v1.75.0...v1.76.0) (2026-04-19)

### Features

* **times-up:** force portrait mode when no game is in progress ([#106](https://github.com/niafrond/niafrond.github.io/issues/106)) ([add6cb8](https://github.com/niafrond/niafrond.github.io/commit/add6cb89927e659726b64699106ca7e0c14edfb6))

## [1.75.0](https://github.com/niafrond/niafrond.github.io/compare/v1.74.0...v1.75.0) (2026-04-19)

### Features

* **times-up:** add undo button to revert last card action ([#105](https://github.com/niafrond/niafrond.github.io/issues/105)) ([a2c610e](https://github.com/niafrond/niafrond.github.io/commit/a2c610e7a683f6c5a7fe199a46520d417f695c24))

## [1.74.0](https://github.com/niafrond/niafrond.github.io/compare/v1.73.0...v1.74.0) (2026-04-19)

### Features

* **times-up:** afficher le nombre de mots restants pendant la manche ([#104](https://github.com/niafrond/niafrond.github.io/issues/104)) ([15745a5](https://github.com/niafrond/niafrond.github.io/commit/15745a5d29c16532198639791b628171518f4e68))

## [1.73.0](https://github.com/niafrond/niafrond.github.io/compare/v1.72.1...v1.73.0) (2026-04-18)

### Features

* **times-up:** manche 2 - remove Erreur button, add prominent Passer side button, fix button widths ([#102](https://github.com/niafrond/niafrond.github.io/issues/102)) ([4ab60b7](https://github.com/niafrond/niafrond.github.io/commit/4ab60b72383fbfd52858ac603b39cf66dbb3b345))

## [1.72.1](https://github.com/niafrond/niafrond.github.io/compare/v1.72.0...v1.72.1) (2026-04-18)

### Bug Fixes

* **times-up:** fix force-update button to properly refresh cached content ([#101](https://github.com/niafrond/niafrond.github.io/issues/101)) ([6540fbb](https://github.com/niafrond/niafrond.github.io/commit/6540fbb259c961bb0f02a94440927c0756616b0d))

## [1.72.0](https://github.com/niafrond/niafrond.github.io/compare/v1.71.0...v1.72.0) (2026-04-18)

### Features

* **times-up:** hide version badge during gameplay, move controls to bottom-right ([#99](https://github.com/niafrond/niafrond.github.io/issues/99)) ([ea828a1](https://github.com/niafrond/niafrond.github.io/commit/ea828a1a20a5eec4146b3233fc3660b5e3b8f752))

## [1.71.0](https://github.com/niafrond/niafrond.github.io/compare/v1.70.1...v1.71.0) (2026-04-18)

### Features

* **times-up:** adapt turn-end screen for landscape, remove found list, auto fullscreen ([#97](https://github.com/niafrond/niafrond.github.io/issues/97)) ([cfbee7b](https://github.com/niafrond/niafrond.github.io/commit/cfbee7b8386a8047f9a081a0a674cf143568179d))

## [1.70.1](https://github.com/niafrond/niafrond.github.io/compare/v1.70.0...v1.70.1) (2026-04-18)

### Bug Fixes

* erreur en manche 2/3 passe la carte au lieu d'arrêter le tour ([#96](https://github.com/niafrond/niafrond.github.io/issues/96)) ([a885dcd](https://github.com/niafrond/niafrond.github.io/commit/a885dcd9252031de3ed95e9a5155482110397f83))

## [1.70.0](https://github.com/niafrond/niafrond.github.io/compare/v1.69.0...v1.70.0) (2026-04-18)

### Features

* **times-up:** add force-refresh button to bust SW cache ([#95](https://github.com/niafrond/niafrond.github.io/issues/95)) ([660d86e](https://github.com/niafrond/niafrond.github.io/commit/660d86e193a94b215fd3a8ee2a1ae948ed93ee72))

## [1.69.0](https://github.com/niafrond/niafrond.github.io/compare/v1.68.2...v1.69.0) (2026-04-18)

### Features

* display build date and time alongside version in all apps ([#94](https://github.com/niafrond/niafrond.github.io/issues/94)) ([518edf8](https://github.com/niafrond/niafrond.github.io/commit/518edf863d4fe437cda69b702f40ceef79e83dd4))

## [1.68.2](https://github.com/niafrond/niafrond.github.io/compare/v1.68.1...v1.68.2) (2026-04-18)

### Bug Fixes

* fitWordCard accounts for trouvé and erreur button widths when sizing word ([#93](https://github.com/niafrond/niafrond.github.io/issues/93)) ([d87ee96](https://github.com/niafrond/niafrond.github.io/commit/d87ee96e5c82301812a199cf7d8262f782ccb154))

## [1.68.1](https://github.com/niafrond/niafrond.github.io/compare/v1.68.0...v1.68.1) (2026-04-18)

### Bug Fixes

* **times-up:** remove team name and emoji from all displays ([#92](https://github.com/niafrond/niafrond.github.io/issues/92)) ([6723485](https://github.com/niafrond/niafrond.github.io/commit/672348530509fa1378591cd60fb832309308a30e))

## [1.68.0](https://github.com/niafrond/niafrond.github.io/compare/v1.67.0...v1.68.0) (2026-04-18)

### Features

* **times-up:** adapt game-over screen to landscape + fix fitWordCard sizing bug ([#91](https://github.com/niafrond/niafrond.github.io/issues/91)) ([f9d058b](https://github.com/niafrond/niafrond.github.io/commit/f9d058b5d825261a4a0db8b0802b0b81a9721130))

## [1.67.0](https://github.com/niafrond/niafrond.github.io/compare/v1.66.0...v1.67.0) (2026-04-18)

### Features

* display version badge from match3-quest/version.js on all apps ([#90](https://github.com/niafrond/niafrond.github.io/issues/90)) ([5551d2d](https://github.com/niafrond/niafrond.github.io/commit/5551d2d4ac3b996a4c5de40e2dc57be57c44bbe0))

## [1.66.0](https://github.com/niafrond/niafrond.github.io/compare/v1.65.0...v1.66.0) (2026-04-18)

### Features

* **times-up:** améliore l'IHM en cours de partie pour le mode paysage ([#89](https://github.com/niafrond/niafrond.github.io/issues/89)) ([f0b1f2a](https://github.com/niafrond/niafrond.github.io/commit/f0b1f2a0fc1bdf2c08397c7cdd32765b2894ff47))

## [1.65.0](https://github.com/niafrond/niafrond.github.io/compare/v1.64.1...v1.65.0) (2026-04-18)

### Features

* affiche le numéro de version dans le footer de index.html ([#87](https://github.com/niafrond/niafrond.github.io/issues/87)) ([cdbaf95](https://github.com/niafrond/niafrond.github.io/commit/cdbaf95cb365ca1aa895f9a0ef123ab8f5d0b505))

## [1.64.1](https://github.com/niafrond/niafrond.github.io/compare/v1.64.0...v1.64.1) (2026-04-18)

### Bug Fixes

* **times-up:** bouton erreur en manche 1, faute arrête le tour dans toutes les manches ([#84](https://github.com/niafrond/niafrond.github.io/issues/84)) ([e0569a0](https://github.com/niafrond/niafrond.github.io/commit/e0569a09f6f881301e0f7b3ff5c7d4f3fa87132b))
* **times-up:** retire la modif de grille de bouton de increase-word-size-display ([#83](https://github.com/niafrond/niafrond.github.io/issues/83)) ([8a2d133](https://github.com/niafrond/niafrond.github.io/commit/8a2d13345e06d0194447a6fd19964e60f8a2fb61))

## [1.64.0](https://github.com/niafrond/niafrond.github.io/compare/v1.63.0...v1.64.0) (2026-04-18)

### Features

* **times-up:** faute manche 2/3 passe la carte définitivement ([#78](https://github.com/niafrond/niafrond.github.io/issues/78)) ([f9c8792](https://github.com/niafrond/niafrond.github.io/commit/f9c8792c146dda761e6116c2c1e58d47a4524d8b))
* **times-up:** remove team names from creation and display ([#79](https://github.com/niafrond/niafrond.github.io/issues/79)) ([830d516](https://github.com/niafrond/niafrond.github.io/commit/830d516787bd63a66477ed8c2f71d261cb13ab56))

### Bug Fixes

* noTeamsMode round-end scoring only attributes points to describer and their guesser ([#80](https://github.com/niafrond/niafrond.github.io/issues/80)) ([51abb8d](https://github.com/niafrond/niafrond.github.io/commit/51abb8d05b21b07af2cf8b3df49c870adf1d88da))
* **times-up:** boutons du tour correctement affichés en portrait et paysage ([#82](https://github.com/niafrond/niafrond.github.io/issues/82)) ([0b0054a](https://github.com/niafrond/niafrond.github.io/commit/0b0054a41e35cd64f96c7b2a201a33354ab46e06))

## [1.63.0](https://github.com/niafrond/niafrond.github.io/compare/v1.62.0...v1.63.0) (2026-04-18)

### Features

* **times-up:** round 1 unlimited guesses, larger word display, neighbor score pooling in 5/7-player mode ([#77](https://github.com/niafrond/niafrond.github.io/issues/77)) ([37b44f5](https://github.com/niafrond/niafrond.github.io/commit/37b44f5efa421071525a07f0e74162198572d69b))

## [1.62.0](https://github.com/niafrond/niafrond.github.io/compare/v1.61.1...v1.62.0) (2026-04-18)

### Features

* enable auto-merge for all ready pull requests ([#65](https://github.com/niafrond/niafrond.github.io/issues/65)) ([bacee85](https://github.com/niafrond/niafrond.github.io/commit/bacee851668cfc77f5de8bdb788c7562dd7f2937))
* **times-up:** add Members tab + swipe mode on turn screen ([#68](https://github.com/niafrond/niafrond.github.io/issues/68)) ([db45a17](https://github.com/niafrond/niafrond.github.io/commit/db45a17ef0a801555c6ad818ead0e12eb61fc959))
* **times-up:** add persistent players tab to setup screen ([#74](https://github.com/niafrond/niafrond.github.io/issues/74)) ([25cf25d](https://github.com/niafrond/niafrond.github.io/commit/25cf25dbbaee6981c6fcf7a180099be1e7d68e49))
* **times-up:** add service worker for JS cache refresh mechanism ([#70](https://github.com/niafrond/niafrond.github.io/issues/70)) ([dab51f8](https://github.com/niafrond/niafrond.github.io/commit/dab51f83dae9c52ef5d428bf73dc8eb7dd332a6b))
* **times-up:** configurable word count per game ([#69](https://github.com/niafrond/niafrond.github.io/issues/69)) ([37803bd](https://github.com/niafrond/niafrond.github.io/commit/37803bd1cdaa29f1f162886415002d5caa2bb7f5))
* **times-up:** fullscreen mode + 2-5-2 grid layout for turn screen ([#73](https://github.com/niafrond/niafrond.github.io/issues/73)) ([9cea595](https://github.com/niafrond/niafrond.github.io/commit/9cea59567e2abf0f260f39823c8256d62f4eec0a))
* **times-up:** remove joueurs/membres tabs, keep players on replay ([#72](https://github.com/niafrond/niafrond.github.io/issues/72)) ([802836a](https://github.com/niafrond/niafrond.github.io/commit/802836ac82daeb634ef4b502dbe6c3b92cffed46))

### Bug Fixes

* fix skip button and timeout word loss in Times Up ([#76](https://github.com/niafrond/niafrond.github.io/issues/76)) ([38efe87](https://github.com/niafrond/niafrond.github.io/commit/38efe87451e399a7f5a87a469f4d86859ee77cf3))
* mobile game screen layout - use 100dvh, buttons always visible, text fills width ([#67](https://github.com/niafrond/niafrond.github.io/issues/67)) ([0baf8eb](https://github.com/niafrond/niafrond.github.io/commit/0baf8eb5f468c6694edb798a0edd698207802e8c))
* **times-up:** auto-fit word width, fix button visibility and portrait blocking ([#64](https://github.com/niafrond/niafrond.github.io/issues/64)) ([7de99e3](https://github.com/niafrond/niafrond.github.io/commit/7de99e31fb826bd9ed0aebe7cb79f7b69176819e))
* trigger semantic-release on pull_request closed instead of push to main ([#71](https://github.com/niafrond/niafrond.github.io/issues/71)) ([53742f4](https://github.com/niafrond/niafrond.github.io/commit/53742f471928412930703b28cb8e308b60624922))
* trigger semantic-release via workflow_dispatch on auto-merge ([#75](https://github.com/niafrond/niafrond.github.io/issues/75)) ([7523b52](https://github.com/niafrond/niafrond.github.io/commit/7523b52c3f025f68591e48e051a2d98e3b795d09))

## [1.61.1](https://github.com/niafrond/niafrond.github.io/compare/v1.61.0...v1.61.1) (2026-04-17)

### Bug Fixes

* hide setup-hint when hidden attribute is set in times-up ([#63](https://github.com/niafrond/niafrond.github.io/issues/63)) ([bf9eee8](https://github.com/niafrond/niafrond.github.io/commit/bf9eee853d5861d68768c5502d721fa22cb666a5))

## [1.61.0](https://github.com/niafrond/niafrond.github.io/compare/v1.60.2...v1.61.0) (2026-04-17)

### Features

* **times-up:** words editor with import/export and per-category counters ([#62](https://github.com/niafrond/niafrond.github.io/issues/62)) ([3008b4a](https://github.com/niafrond/niafrond.github.io/commit/3008b4a66ba8d84de8bb3242bfd88a0a83d287b0))

## [1.60.2](https://github.com/niafrond/niafrond.github.io/compare/v1.60.1...v1.60.2) (2026-04-17)

### Bug Fixes

* **times-up:** implement rounds 2 & 3 rules - round 3 allows passing, update descriptions ([#61](https://github.com/niafrond/niafrond.github.io/issues/61)) ([42f2601](https://github.com/niafrond/niafrond.github.io/commit/42f260191014304e5623d549af2304e6b3ec158b))

## [1.60.1](https://github.com/niafrond/niafrond.github.io/compare/v1.60.0...v1.60.1) (2026-04-17)

### Bug Fixes

* **times-up:** Erreur/Passer unreachable in landscape — redesign turn screen layout ([#60](https://github.com/niafrond/niafrond.github.io/issues/60)) ([2d0a275](https://github.com/niafrond/niafrond.github.io/commit/2d0a275f59625231585c2721d2860c29b72c7576)), closes [#rotate-overlay](https://github.com/niafrond/niafrond.github.io/issues/rotate-overlay)

## [1.60.0](https://github.com/niafrond/niafrond.github.io/compare/v1.59.0...v1.60.0) (2026-04-17)

### Features

* Time's Up Nout Péi — team layout, per-round rules, 3 action buttons ([#59](https://github.com/niafrond/niafrond.github.io/issues/59)) ([332e329](https://github.com/niafrond/niafrond.github.io/commit/332e329f2136c0bc6643b26a7f51f87d1697cab2))

## [1.59.0](https://github.com/niafrond/niafrond.github.io/compare/v1.58.0...v1.59.0) (2026-04-11)

### Features

* fusionne les modes hôtes lecteur et animateur ([#57](https://github.com/niafrond/niafrond.github.io/issues/57)) ([766ad1a](https://github.com/niafrond/niafrond.github.io/commit/766ad1ac77dc58e5f90d0ac2c637d84da315f1be))

## [1.58.0](https://github.com/niafrond/niafrond.github.io/compare/v1.57.0...v1.58.0) (2026-04-11)

### Features

* **quiz:** add Buzz QCM game mode ([#55](https://github.com/niafrond/niafrond.github.io/issues/55)) ([3b866df](https://github.com/niafrond/niafrond.github.io/commit/3b866df218ae06267b964664d1a59924482b410d))

## [1.57.0](https://github.com/niafrond/niafrond.github.io/compare/v1.56.0...v1.57.0) (2026-04-11)

### Features

* add party mini-games as standalone classic game modes ([#56](https://github.com/niafrond/niafrond.github.io/issues/56)) ([5e2aef1](https://github.com/niafrond/niafrond.github.io/commit/5e2aef12f8787b7091363779f92278853b281a28))

## [1.56.0](https://github.com/niafrond/niafrond.github.io/compare/v1.55.1...v1.56.0) (2026-04-11)

### Features

* **quiz:** mode animateur — révélation manuelle de la réponse par l'hôte ([#53](https://github.com/niafrond/niafrond.github.io/issues/53)) ([f5d5478](https://github.com/niafrond/niafrond.github.io/commit/f5d547840559b23a48946ff882e9a4558b6ba7ec))

## [1.55.1](https://github.com/niafrond/niafrond.github.io/compare/v1.55.0...v1.55.1) (2026-04-10)

### Bug Fixes

* supprimer le doublon de joueur lors d'une reconnexion avec un nouveau peer ID ([#52](https://github.com/niafrond/niafrond.github.io/issues/52)) ([a9e7389](https://github.com/niafrond/niafrond.github.io/commit/a9e73893f935873939b4a71e91b534b9408bd8ad))

## [1.55.0](https://github.com/niafrond/niafrond.github.io/compare/v1.54.0...v1.55.0) (2026-04-10)

### Features

* gray out game modes that require more players than currently present ([#50](https://github.com/niafrond/niafrond.github.io/issues/50)) ([73d96fb](https://github.com/niafrond/niafrond.github.io/commit/73d96fb32826d183e4b721896ef5d730f1cf0924))

## [1.54.0](https://github.com/niafrond/niafrond.github.io/compare/v1.53.3...v1.54.0) (2026-04-10)

### Features

* **quiz:** choix du nombre de questions par mini-jeu en mode party ([#51](https://github.com/niafrond/niafrond.github.io/issues/51)) ([313478d](https://github.com/niafrond/niafrond.github.io/commit/313478d134f978a868c02e35b9029241be4758c6))

## [1.53.3](https://github.com/niafrond/niafrond.github.io/compare/v1.53.2...v1.53.3) (2026-04-10)

### Bug Fixes

* make Race, Blitz, Carousel respect _activePlayers() (host as player bug) ([#49](https://github.com/niafrond/niafrond.github.io/issues/49)) ([e269cc1](https://github.com/niafrond/niafrond.github.io/commit/e269cc1a22c57fa897756c5938338ff293d6a158))

## [1.53.2](https://github.com/niafrond/niafrond.github.io/compare/v1.53.1...v1.53.2) (2026-04-10)

### Performance Improvements

* **qr:** fix scanner performance on low-end phones ([#48](https://github.com/niafrond/niafrond.github.io/issues/48)) ([ec9b54f](https://github.com/niafrond/niafrond.github.io/commit/ec9b54f698fbc1df9fb27cad281e1482ef90e411))

## [1.53.1](https://github.com/niafrond/niafrond.github.io/compare/v1.53.0...v1.53.1) (2026-04-10)

### Bug Fixes

* make party mini-game overlay fixed to cover full viewport on mobile ([#47](https://github.com/niafrond/niafrond.github.io/issues/47)) ([5dff079](https://github.com/niafrond/niafrond.github.io/commit/5dff079ab6a8c058f1928e6925e09125d855e0a0))

## [1.53.0](https://github.com/niafrond/niafrond.github.io/compare/v1.52.0...v1.53.0) (2026-04-10)

### Features

* make party rules block fill full page height in party mode ([#46](https://github.com/niafrond/niafrond.github.io/issues/46)) ([071b659](https://github.com/niafrond/niafrond.github.io/commit/071b6598abbfad9b1f1b206ef7f89fddd65c5356))

## [1.52.0](https://github.com/niafrond/niafrond.github.io/compare/v1.51.0...v1.52.0) (2026-04-10)

### Features

* **quiz:** add QuizzAPI v2 as secondary French question source ([#43](https://github.com/niafrond/niafrond.github.io/issues/43)) ([19664bc](https://github.com/niafrond/niafrond.github.io/commit/19664bc4f7662ac39a839efa54b287471e5cbf51))

## [1.51.0](https://github.com/niafrond/niafrond.github.io/compare/v1.50.0...v1.51.0) (2026-04-10)

### Features

* **quiz:** persist host peer ID for 1-hour session reuse ([#44](https://github.com/niafrond/niafrond.github.io/issues/44)) ([931a7bb](https://github.com/niafrond/niafrond.github.io/commit/931a7bbaefe7429aa70406837aa955eade654eda))

## [1.50.0](https://github.com/niafrond/niafrond.github.io/compare/v1.49.4...v1.50.0) (2026-04-10)

### Features

* **quiz:** verify photo reachability before proposing photo questions ([#41](https://github.com/niafrond/niafrond.github.io/issues/41)) ([c0c0a6a](https://github.com/niafrond/niafrond.github.io/commit/c0c0a6a756f03681b81ed03fe673bbc970f4a22a))

## [1.49.4](https://github.com/niafrond/niafrond.github.io/compare/v1.49.3...v1.49.4) (2026-04-10)

### Bug Fixes

* QR scanner - ajout logs et scan sur capture (non temps réel) ([#40](https://github.com/niafrond/niafrond.github.io/issues/40)) ([95d2074](https://github.com/niafrond/niafrond.github.io/commit/95d20746fcf3c0f100cb494cdac5d44a6039e0e3))

## [1.49.3](https://github.com/niafrond/niafrond.github.io/compare/v1.49.2...v1.49.3) (2026-04-10)

### Bug Fixes

* replace Wikimedia thumbnail URLs with Special:FilePath redirect URLs ([#38](https://github.com/niafrond/niafrond.github.io/issues/38)) ([ddb1719](https://github.com/niafrond/niafrond.github.io/commit/ddb17193e192dcb13d573a1360d23b8d7ddc9f31))

## [1.49.2](https://github.com/niafrond/niafrond.github.io/compare/v1.49.1...v1.49.2) (2026-04-10)

### Bug Fixes

* remove undefined openBtn reference in QR scanner ([#37](https://github.com/niafrond/niafrond.github.io/issues/37)) ([d64aaed](https://github.com/niafrond/niafrond.github.io/commit/d64aaed6ba000c46f192a7de1a508db7f164b86f))

## [1.49.1](https://github.com/niafrond/niafrond.github.io/compare/v1.49.0...v1.49.1) (2026-04-10)

### Bug Fixes

* mark all returning players ready on replay; add referrerpolicy on photo img ([#35](https://github.com/niafrond/niafrond.github.io/issues/35)) ([7754527](https://github.com/niafrond/niafrond.github.io/commit/7754527a021efe098668696fcf71e1ca3bda89b1))

## [1.49.0](https://github.com/niafrond/niafrond.github.io/compare/v1.48.0...v1.49.0) (2026-04-10)

### Features

* add offline QR code scanner PWA ([#34](https://github.com/niafrond/niafrond.github.io/issues/34)) ([b2d708e](https://github.com/niafrond/niafrond.github.io/commit/b2d708ea88d2aa412472938e92ad643aa9b6db73))

## [1.48.0](https://github.com/niafrond/niafrond.github.io/compare/v1.47.1...v1.48.0) (2026-04-10)

### Features

* **quiz:** mode Ping-Pong passe aux choix QCM ([#30](https://github.com/niafrond/niafrond.github.io/issues/30)) ([23ecb01](https://github.com/niafrond/niafrond.github.io/commit/23ecb014d1e93b0b8170253bda28c8a87c9e0735))

## [1.47.1](https://github.com/niafrond/niafrond.github.io/compare/v1.47.0...v1.47.1) (2026-04-10)

### Bug Fixes

* use Wikimedia URLs for quiz photo questions instead of missing local files ([#29](https://github.com/niafrond/niafrond.github.io/issues/29)) ([ecd8a33](https://github.com/niafrond/niafrond.github.io/commit/ecd8a33fd3804ff82112bf5946accd2e1026b9ee))

## [1.47.0](https://github.com/niafrond/niafrond.github.io/compare/v1.46.0...v1.47.0) (2026-04-10)

### Features

* **quiz:** ajoute 52 questions photo (monuments/animaux mondiaux + Réunion) ([#28](https://github.com/niafrond/niafrond.github.io/issues/28)) ([2112951](https://github.com/niafrond/niafrond.github.io/commit/21129517bb6fe1ac44ce568531cdfee7a1dec2da))

## [1.46.0](https://github.com/niafrond/niafrond.github.io/compare/v1.45.0...v1.46.0) (2026-04-09)

### Features

* host is a player in party mode, hide answers from non-reader host ([#26](https://github.com/niafrond/niafrond.github.io/issues/26)) ([b1e5183](https://github.com/niafrond/niafrond.github.io/commit/b1e5183d6c473c5ccc0fa6b22520d5f77e5f0211))

## [1.45.0](https://github.com/niafrond/niafrond.github.io/compare/v1.44.0...v1.45.0) (2026-04-09)

### Features

* **quiz:** rebase on main + extend Party mode to all 6 game modes with random selection ([#25](https://github.com/niafrond/niafrond.github.io/issues/25)) ([f2372e1](https://github.com/niafrond/niafrond.github.io/commit/f2372e10f15ccb2bc50db151cc43289bafffac6d))

## [1.44.0](https://github.com/niafrond/niafrond.github.io/compare/v1.43.0...v1.44.0) (2026-04-09)

### Features

* **quiz:** add Party mode with 3 QCM mini-games, animated transitions, and question deduplication ([#24](https://github.com/niafrond/niafrond.github.io/issues/24)) ([1aef047](https://github.com/niafrond/niafrond.github.io/commit/1aef0472e9dd4947065dfe66478f161fa0f6b1ec))

## [1.43.0](https://github.com/niafrond/niafrond.github.io/compare/v1.42.0...v1.43.0) (2026-04-09)

### Features

* **quiz:** replay keeps peer ID, allows changing game criteria ([#22](https://github.com/niafrond/niafrond.github.io/issues/22)) ([ebd0a66](https://github.com/niafrond/niafrond.github.io/commit/ebd0a662cb5aff368a14b7a409a5493f7ec8bdbd))

## [1.42.0](https://github.com/niafrond/niafrond.github.io/compare/v1.41.0...v1.42.0) (2026-04-07)

### Features

* **quiz:** add host reader mode — host reads questions, judges oral answers, doesn't play ([#20](https://github.com/niafrond/niafrond.github.io/issues/20)) ([d0814ad](https://github.com/niafrond/niafrond.github.io/commit/d0814ad69580979b99fafd84c81752a7fe9b0233))

## [1.41.0](https://github.com/niafrond/niafrond.github.io/compare/v1.40.0...v1.41.0) (2026-04-07)

### Features

* **quiz:** multi-select chip pickers for categories and difficulties ([#19](https://github.com/niafrond/niafrond.github.io/issues/19)) ([df49f92](https://github.com/niafrond/niafrond.github.io/commit/df49f928704a3228a4de122748dc40f464c4e52c))

## [1.40.0](https://github.com/niafrond/niafrond.github.io/compare/v1.39.0...v1.40.0) (2026-04-07)

### Features

* quiz wrong-player notification, category badges, Île de la Réunion ([#18](https://github.com/niafrond/niafrond.github.io/issues/18)) ([1109de7](https://github.com/niafrond/niafrond.github.io/commit/1109de730514ea11d8424f34648143d19ad80c8e))

## [1.39.0](https://github.com/niafrond/niafrond.github.io/compare/v1.38.1...v1.39.0) (2026-04-07)

### Features

* retire bouton Valider en mode QCM et ajoute option mute sons ([#17](https://github.com/niafrond/niafrond.github.io/issues/17)) ([ec95cb5](https://github.com/niafrond/niafrond.github.io/commit/ec95cb5d8f73f42dc7e991745499076b19628090))

## [1.38.1](https://github.com/niafrond/niafrond.github.io/compare/v1.38.0...v1.38.1) (2026-04-07)

### Bug Fixes

* wrong-answer overlay CSS overrides hidden attribute ([#16](https://github.com/niafrond/niafrond.github.io/issues/16)) ([9cecd4f](https://github.com/niafrond/niafrond.github.io/commit/9cecd4f54473875663aa5d1cfc17839ae5ae6d07))

## [1.38.0](https://github.com/niafrond/niafrond.github.io/compare/v1.37.0...v1.38.0) (2026-04-07)

### Features

* **quiz:** add synthetic sounds via Web Audio API ([#15](https://github.com/niafrond/niafrond.github.io/issues/15)) ([a5c76e9](https://github.com/niafrond/niafrond.github.io/commit/a5c76e9e5ea305ef9f02dad486d8a73d614970bb))

## [1.37.0](https://github.com/niafrond/niafrond.github.io/compare/v1.36.0...v1.37.0) (2026-04-06)

### Features

* **quiz:** hide next-question btn for clients, reconnect via localStorage, wrong-answer overlay ([#14](https://github.com/niafrond/niafrond.github.io/issues/14)) ([1ace0c8](https://github.com/niafrond/niafrond.github.io/commit/1ace0c8da45ac848011a20d319ed84c540f5d6c0))

## [1.36.0](https://github.com/niafrond/niafrond.github.io/compare/v1.35.1...v1.36.0) (2026-04-06)

### Features

* Quiz Multijoueur P2P avec questions en français ([#12](https://github.com/niafrond/niafrond.github.io/issues/12)) ([d9dc7b2](https://github.com/niafrond/niafrond.github.io/commit/d9dc7b2827d1fab5e62862a02c72c77fed83fde3))

## [1.35.1](https://github.com/niafrond/niafrond.github.io/compare/v1.35.0...v1.35.1) (2026-04-05)

### Bug Fixes

* catch network fetch error and show user-friendly message in rando-piton ([#11](https://github.com/niafrond/niafrond.github.io/issues/11)) ([2bb0a1d](https://github.com/niafrond/niafrond.github.io/commit/2bb0a1da855b67c85023e8d11d4119c9e1a8f3c7))

## [1.35.0](https://github.com/niafrond/niafrond.github.io/compare/v1.34.1...v1.35.0) (2026-04-05)

### Features

* Copilot Dev — mobile PWA to send prompts and apply generated code to a GitHub repo ([#10](https://github.com/niafrond/niafrond.github.io/issues/10)) ([a3b6569](https://github.com/niafrond/niafrond.github.io/commit/a3b6569477ee23bd8307c3c45ba156e316cbc345))

## [1.34.1](https://github.com/niafrond/niafrond.github.io/compare/v1.34.0...v1.34.1) (2026-04-05)

### Bug Fixes

* correct GPX URL format to include /trace/ segment ([#9](https://github.com/niafrond/niafrond.github.io/issues/9)) ([2c36da5](https://github.com/niafrond/niafrond.github.io/commit/2c36da5b91235fa91de967a9a20df1ddbeb3f43e))

## [1.34.0](https://github.com/niafrond/niafrond.github.io/compare/v1.33.4...v1.34.0) (2026-04-05)

### Features

* remove useless GitHub/Copilot auth buttons and dead device flow code ([#8](https://github.com/niafrond/niafrond.github.io/issues/8)) ([73b5204](https://github.com/niafrond/niafrond.github.io/commit/73b5204600e0af83eb673e57ea014b74e109f420))

## [1.33.4](https://github.com/niafrond/niafrond.github.io/compare/v1.33.3...v1.33.4) (2026-04-05)

### Bug Fixes

* route GitHub Device Flow requests through corsproxy.io to fix CORS ([#6](https://github.com/niafrond/niafrond.github.io/issues/6)) ([c6854c5](https://github.com/niafrond/niafrond.github.io/commit/c6854c534176abf21505ca488ce14c74220c12b0))

## [1.33.3](https://github.com/niafrond/niafrond.github.io/compare/v1.33.2...v1.33.3) (2026-04-05)

### Bug Fixes

* replace Jina.ai with allorigins proxy and fix GitHub Device Flow CORS ([#5](https://github.com/niafrond/niafrond.github.io/issues/5)) ([2b30829](https://github.com/niafrond/niafrond.github.io/commit/2b308290ad7a6e4111bfa82d04899e725a31e721))

## [1.33.2](https://github.com/niafrond/niafrond.github.io/compare/v1.33.1...v1.33.2) (2026-04-05)

### Bug Fixes

* make GitHub device flow code visible and copyable ([#4](https://github.com/niafrond/niafrond.github.io/issues/4)) ([1721043](https://github.com/niafrond/niafrond.github.io/commit/1721043dcbdc9311873e5cc572ec5f3f7d89b606))

## [1.33.1](https://github.com/niafrond/niafrond.github.io/compare/v1.33.0...v1.33.1) (2026-04-05)

### Bug Fixes

* **rando-piton:** corriger les appels API (Jina HTTPS et compteur séparé) ([#3](https://github.com/niafrond/niafrond.github.io/issues/3)) ([7a4c7df](https://github.com/niafrond/niafrond.github.io/commit/7a4c7df1264c2dda803148443fb8380c6e1e1763))

## [1.33.0](https://github.com/niafrond/niafrond.github.io/compare/v1.32.1...v1.33.0) (2026-04-05)

### Features

* **mobile-dev-hub:** add GitHub OAuth Device Flow auth buttons ([#2](https://github.com/niafrond/niafrond.github.io/issues/2)) ([f092846](https://github.com/niafrond/niafrond.github.io/commit/f0928469cb5dc8afeb40b6039aa168fe4108bd08))

## [1.32.1](https://github.com/niafrond/niafrond.github.io/compare/v1.32.0...v1.32.1) (2026-04-05)

### Bug Fixes

* **rando-piton:** restaurer les fiches hors ligne depuis le cache SW au démarrage ([#1](https://github.com/niafrond/niafrond.github.io/issues/1)) ([0c0bc44](https://github.com/niafrond/niafrond.github.io/commit/0c0bc44a1c76722e81e22796f8ad9276cd4076ad))

## [1.32.0](https://github.com/niafrond/niafrond.github.io/compare/v1.31.0...v1.32.0) (2026-04-05)

### Features

* **mobile-dev-hub:** ajouter une application pour piloter GitHub avec Copilot et optimiser l'interface mobile ([d43f400](https://github.com/niafrond/niafrond.github.io/commit/d43f40069c81b3a514be5ad25e5eaceb55c83ea0))

## [1.31.0](https://github.com/niafrond/niafrond.github.io/compare/v1.30.0...v1.31.0) (2026-04-05)

### Features

* **rando-piton:** ajouter des fonctionnalités d'expansion et de réduction à la liste des sentiers ([4d7da8b](https://github.com/niafrond/niafrond.github.io/commit/4d7da8b3fb2029d53a1bf463d96775d7382edd4d))

## [1.30.0](https://github.com/niafrond/niafrond.github.io/compare/v1.29.0...v1.30.0) (2026-04-05)

### Features

* **filtres:** ajouter un filtre de difficulté et gérer l'affichage des messages vides ([32b7ea1](https://github.com/niafrond/niafrond.github.io/commit/32b7ea1455e78443c644d639d795905064f0824a))

## [1.29.0](https://github.com/niafrond/niafrond.github.io/compare/v1.28.0...v1.29.0) (2026-04-05)

### Features

* **rando-piton:** catalogue.json 907 fiches + recherche live + robots.txt ([af32820](https://github.com/niafrond/niafrond.github.io/commit/af328209398ef3dcfe2654d88d81e05f0637e69e))

## [1.28.0](https://github.com/niafrond/niafrond.github.io/compare/v1.27.0...v1.28.0) (2026-04-05)

### Features

* ajouter des sentiers de randonnée par défaut et supprimer le fichier de données ([e4b5105](https://github.com/niafrond/niafrond.github.io/commit/e4b5105850d3da479af511eab1a6954739466f55))

## [1.27.0](https://github.com/niafrond/niafrond.github.io/compare/v1.26.0...v1.27.0) (2026-04-05)

### Features

* améliorer la gestion du service worker avec un rechargement automatique et des stratégies de mise en cache ([ec7b3ed](https://github.com/niafrond/niafrond.github.io/commit/ec7b3ed92c69fcd33f6cccc66d896ad248bd900f))

## [1.26.0](https://github.com/niafrond/niafrond.github.io/compare/v1.25.0...v1.26.0) (2026-04-05)

### Features

* afficher la version actuelle du site dans l'en-tête de l'application ([18b39e1](https://github.com/niafrond/niafrond.github.io/commit/18b39e14b5a7ed5d737fab4f8e72d00e7fb40d7d))
* ajouter l'importation directe des suggestions Randopitons en fiches hors ligne ([478e436](https://github.com/niafrond/niafrond.github.io/commit/478e436bc38bd1e4c77bd3411f2db38ef0623f3d))

## [1.25.0](https://github.com/niafrond/niafrond.github.io/compare/v1.24.0...v1.25.0) (2026-04-05)

### Features

* ajouter des suggestions de recherche Randopitons et un bouton pour ouvrir les résultats source ([d91db40](https://github.com/niafrond/niafrond.github.io/commit/d91db402e4b893d0dafd535c62a00c32ef85dd01))

## [1.24.0](https://github.com/niafrond/niafrond.github.io/compare/v1.23.0...v1.24.0) (2026-04-05)

### Features

* ajouter un bouton pour afficher les fiches hors ligne dans le formulaire de recherche ([403ad64](https://github.com/niafrond/niafrond.github.io/commit/403ad64e9948d3822d4eefff84c6903248fce391))

## [1.23.0](https://github.com/niafrond/niafrond.github.io/compare/v1.22.0...v1.23.0) (2026-04-05)

### Features

* améliorer le formulaire de recherche avec validation et actions dédiées ([126fe85](https://github.com/niafrond/niafrond.github.io/commit/126fe855d55d055fc87982afa7ed6d4736891b0f))

## [1.22.0](https://github.com/niafrond/niafrond.github.io/compare/v1.21.0...v1.22.0) (2026-04-05)

### Features

* ajouter une recherche flottante et un panneau de recherche pour Rando Piton ([783d5bc](https://github.com/niafrond/niafrond.github.io/commit/783d5bc9eec7d3658ae907be8daa315684162f9b))

## [1.21.0](https://github.com/niafrond/niafrond.github.io/compare/v1.20.0...v1.21.0) (2026-04-05)

### Features

* add initial implementation of Rando Piton PWA with hiking trails data ([f33feae](https://github.com/niafrond/niafrond.github.io/commit/f33feaea3101df6d687bf5e3c789ac7733ad41a1))

## [1.20.0](https://github.com/niafrond/niafrond.github.io/compare/v1.19.0...v1.20.0) (2026-04-03)

### Features

* refactor la gestion des littéraux JSON pour supporter les chaînes concaténées ([a659697](https://github.com/niafrond/niafrond.github.io/commit/a659697228cb480e8f71364869c71547e5d759a0))

## [1.19.0](https://github.com/niafrond/niafrond.github.io/compare/v1.18.0...v1.19.0) (2026-04-02)

### Features

* remplacer la récupération de la version du test à l'aveugle par celle du match3 et ajouter des fonctions pour extraire des littéraux JSON ([2882513](https://github.com/niafrond/niafrond.github.io/commit/288251384b2522d96ceb71113fd457a14b8c2850))

## [1.18.0](https://github.com/niafrond/niafrond.github.io/compare/v1.17.0...v1.18.0) (2026-04-02)

### Features

* simplifier la récupération de la version du test à l'aveugle en utilisant la version du match3 ([03aa678](https://github.com/niafrond/niafrond.github.io/commit/03aa6784015f76dcd5e0944926564e635c80c1cc))

## [1.17.0](https://github.com/niafrond/niafrond.github.io/compare/v1.16.0...v1.17.0) (2026-04-02)

### Features

* refactor la gestion des versions en utilisant une fonction formatSemver pour le formatage des versions ([20e3382](https://github.com/niafrond/niafrond.github.io/commit/20e3382b1cfe47f1045c8579ff00b58645a1b5ac))

## [1.16.0](https://github.com/niafrond/niafrond.github.io/compare/v1.15.0...v1.16.0) (2026-04-02)

### Features

* améliorer l'extraction des littéraux JSON en ajoutant des fonctions pour gérer les valeurs immédiates et les objets JSON ([730cdf2](https://github.com/niafrond/niafrond.github.io/commit/730cdf2760ca5666f563c5434b84d4149e6719d9))

## [1.15.0](https://github.com/niafrond/niafrond.github.io/compare/v1.14.0...v1.15.0) (2026-04-02)

### Features

* améliorer la gestion des erreurs lors de l'extraction de ytInitialData et ajouter des fonctions utilitaires pour le prétraitement des chaînes ([95f2345](https://github.com/niafrond/niafrond.github.io/commit/95f2345f77dcf5ae0cc55fc49981ef672608c952))

## [1.14.0](https://github.com/niafrond/niafrond.github.io/compare/v1.13.0...v1.14.0) (2026-04-02)

### Features

* ajouter des fonctions pour décoder des littéraux JSON et extraire des données JSON ([0c27f25](https://github.com/niafrond/niafrond.github.io/commit/0c27f252550786972e877dd0864b1a8a91be1113))

## [1.13.0](https://github.com/niafrond/niafrond.github.io/compare/v1.12.0...v1.13.0) (2026-04-02)

### Features

* ajouter l'affichage de la version du blind test et le style associé ([0b90902](https://github.com/niafrond/niafrond.github.io/commit/0b9090222dc6f789018b7f98c11e3ca6df438a0a))

## [1.12.0](https://github.com/niafrond/niafrond.github.io/compare/v1.11.0...v1.12.0) (2026-04-02)

### Features

* ajouter la gestion des formats de réponse et améliorer la validation des réponses ([e6c5c8a](https://github.com/niafrond/niafrond.github.io/commit/e6c5c8af3a5ee86996a9a35eced912bbf67e2454))

## [1.11.0](https://github.com/niafrond/niafrond.github.io/compare/v1.10.0...v1.11.0) (2026-04-02)

### Features

* ajouter la gestion de la source audio préférée et améliorer la gestion des erreurs de lecture ([6e6f7cd](https://github.com/niafrond/niafrond.github.io/commit/6e6f7cdd29d9b10c00f35e4c3b8661bafd0b204c))

## [1.10.0](https://github.com/niafrond/niafrond.github.io/compare/v1.9.0...v1.10.0) (2026-04-02)

### Features

* améliorer la gestion des instances Piped et Invidious avec une logique de priorisation ([4f2dffb](https://github.com/niafrond/niafrond.github.io/commit/4f2dffba907e4d25c2722f9fe9c77d0b24ce7530))

## [1.9.0](https://github.com/niafrond/niafrond.github.io/compare/v1.8.0...v1.9.0) (2026-04-02)

### Features

* réduire la fenêtre joker à 5 secondes et gérer les erreurs de lecture audio ([ec96aa8](https://github.com/niafrond/niafrond.github.io/commit/ec96aa81b119158d0b1e82999c29de7621d9d338))

## [1.8.0](https://github.com/niafrond/niafrond.github.io/compare/v1.7.0...v1.8.0) (2026-04-02)

### Features

* add timer seconds display and update logic for joker window phase ([c0fc148](https://github.com/niafrond/niafrond.github.io/commit/c0fc1481d09534cdea8d2ab20bdd6d93e57b57ee))
* implement joker window phase with UI and game logic updates ([69e504d](https://github.com/niafrond/niafrond.github.io/commit/69e504d182781641454809ca52d6d25d3ee202b9))

## [1.7.0](https://github.com/niafrond/niafrond.github.io/compare/v1.6.0...v1.7.0) (2026-04-02)

### Features

* add UI and YouTube audio handling for Blind Test game ([420746a](https://github.com/niafrond/niafrond.github.io/commit/420746ab1cb61da71c159b7684864ca6e9e00486))

## [1.6.0](https://github.com/niafrond/niafrond.github.io/compare/v1.5.0...v1.6.0) (2026-03-14)

### Features

* Implement tutorial system with guided steps and UI elements ([d2dfffe](https://github.com/niafrond/niafrond.github.io/commit/d2dfffea24f29cebe65d4754e40e5f39478261da))

## [1.5.0](https://github.com/niafrond/niafrond.github.io/compare/v1.4.0...v1.5.0) (2026-03-11)

### Features

* Implement custom battle music for enemies and add audio volume control ([3e2e393](https://github.com/niafrond/niafrond.github.io/commit/3e2e3932f98628c18774917aff7afc376182e63b))
* Remove old WAV tracks and replace with new MP3 tracks in match3-quest ([6c9bc03](https://github.com/niafrond/niafrond.github.io/commit/6c9bc039149377814a704850636dec54aa9126fa))

## [1.4.0](https://github.com/niafrond/niafrond.github.io/compare/v1.3.0...v1.4.0) (2026-03-11)

### Features

* Add custom battle music for enemies and implement music playback controls ([09b0df4](https://github.com/niafrond/niafrond.github.io/commit/09b0df4b84afb8c507e65253dbc5b38b7db1bd1b))

## [1.3.0](https://github.com/niafrond/niafrond.github.io/compare/v1.2.0...v1.3.0) (2026-03-11)

### Features

* Ajouter des contrôles de volume pour la musique et les effets sonores ([2bebf49](https://github.com/niafrond/niafrond.github.io/commit/2bebf49d4895ae08ad82bd28fac69d98da7bef3c))

## [1.2.0](https://github.com/niafrond/niafrond.github.io/compare/v1.1.0...v1.2.0) (2026-03-10)

### Features

* Add dark mode toggle and implement responsive board resizing ([678092e](https://github.com/niafrond/niafrond.github.io/commit/678092ecaa4d75976b6312c4153319a29384da43))

## [1.1.0](https://github.com/niafrond/niafrond.github.io/compare/v1.0.3...v1.1.0) (2026-03-10)

### Features

* Implement boss enemy mechanics and enhance player tracking for defeated bosses ([01e9589](https://github.com/niafrond/niafrond.github.io/commit/01e9589b3df1ddacd06de10c83c078c7f87f4483))

## [1.0.3](https://github.com/niafrond/niafrond.github.io/compare/v1.0.2...v1.0.3) (2026-03-10)

### Bug Fixes

* Corriger le déclenchement du workflow pour ne s'exécuter que sur la branche principale ([18ba7fa](https://github.com/niafrond/niafrond.github.io/commit/18ba7fa6689282b52ea496ec23e9857a8f7cef25))

## [1.0.2](https://github.com/niafrond/niafrond.github.io/compare/v1.0.1...v1.0.2) (2026-03-10)

### Bug Fixes

* Mettre à jour la condition d'exécution du job de release pour éviter les déclenchements indésirables ([f379e43](https://github.com/niafrond/niafrond.github.io/commit/f379e43509f4af3afeecd92fb75c0f0c8758fd76))

## [1.0.1](https://github.com/niafrond/niafrond.github.io/compare/v1.0.0...v1.0.1) (2026-03-10)

### Bug Fixes

* Corriger la condition pour éviter l'exécution par le bot GitHub dans le workflow de release ([ab8022c](https://github.com/niafrond/niafrond.github.io/commit/ab8022c34f35668e99d1b25e06b304f7a227c30e))

## 1.0.0 (2026-03-10)

### Features

* Add combat music profiles by enemy family; enhance audio management ([1ee329f](https://github.com/niafrond/niafrond.github.io/commit/1ee329f46e4aa1112f810c9ab918fc559ee07a1f))
* add shop tab and implement weapon purchasing functionality ([8782a50](https://github.com/niafrond/niafrond.github.io/commit/8782a50cc4879ac31a2653116c50d455d60cdc01))
* add tabbed interface for combat, inventory, spells, and stats ([3fdbf34](https://github.com/niafrond/niafrond.github.io/commit/3fdbf34262e8b70ea7fa7281c9b836c1ccdc5e32))
* Ajouter des événements de cycle de vie mobile pour synchroniser l'état audio ([8f26afd](https://github.com/niafrond/niafrond.github.io/commit/8f26afd8ee1e0a2f6b217d89f9c5cad315a1b026))
* Ajouter des info-bulles pour les objets ennemis et alliés dans l'interface ([ee79937](https://github.com/niafrond/niafrond.github.io/commit/ee7993792e399b41b6f51d74032d2851cfdcf19b))
* Ajouter la collecte de mana pour les tuiles de couleur détruites et améliorer la gestion des sorts ([4508fd5](https://github.com/niafrond/niafrond.github.io/commit/4508fd5483c030a546aca505ea153a1f23c7b80d))
* Ajouter la génération de plateau initial sans correspondances avec des tuiles pondérées ([a8e31c5](https://github.com/niafrond/niafrond.github.io/commit/a8e31c56d1b04b75a01edc27c21a8a1eda46d980))
* Ajouter la gestion de la difficulté de l'IA en fonction du profil de l'ennemi ([5d99e64](https://github.com/niafrond/niafrond.github.io/commit/5d99e640d9730680081f5a5fbab6fbde6333b156))
* Ajouter la gestion de la version et l'automatisation des releases avec semantic-release ([97e0376](https://github.com/niafrond/niafrond.github.io/commit/97e0376dde5d106a89b3adee6bf4f74be6453d90))
* Ajouter la gestion des couleurs de sorts et des affinités de couleur pour les ennemis ([7f20a86](https://github.com/niafrond/niafrond.github.io/commit/7f20a8641a6392ea2187b7e98e42769af39cd875))
* Ajouter le plugin conventional-changelog-conventionalcommits pour la gestion des changelogs ([0b34fe1](https://github.com/niafrond/niafrond.github.io/commit/0b34fe1f68158f167dd79ab6cbc5782ff46d3cf3))
* Ajouter un garde de visibilité audio pour synchroniser l'état de la musique en fonction de la visibilité du jeu ([98fc3f3](https://github.com/niafrond/niafrond.github.io/commit/98fc3f3e7a85fafb46946ba6e520b5d3be5a29cd))
* Ajouter une variable d'environnement pour forcer l'utilisation de Node.js dans les actions JavaScript ([27d4f6c](https://github.com/niafrond/niafrond.github.io/commit/27d4f6c39f07c187775b264b82dc5e20191088b9))
* Ajuster les probabilités de chute des tuiles en fonction des sorts disponibles ([00bed45](https://github.com/niafrond/niafrond.github.io/commit/00bed4531592a5d98763568a06a16f24c82ff599))
* Améliorer le calcul de l'XP en tenant compte des statistiques des ennemis et ajuster la génération des choix d'ennemis ([850f7b8](https://github.com/niafrond/niafrond.github.io/commit/850f7b8ab28792e710f7935be3c756de0dd1de1e))
* Enhance audio management with combat music controls; update mute settings and UI interactions ([c4073ac](https://github.com/niafrond/niafrond.github.io/commit/c4073acf8b20cb5cf43485e5744926057bee4a18))
* Enhance board generation and combat mechanics ([3e22066](https://github.com/niafrond/niafrond.github.io/commit/3e22066ca7455632c32f8f60320b44852a204e6d))
* Enhance combat mechanics and inventory management ([56ae43b](https://github.com/niafrond/niafrond.github.io/commit/56ae43b6aeeae7882a00cdba7d347168f1769fe7))
* Enhance combat mechanics with active item checks; improve spell and weapon UI interactions ([d3639aa](https://github.com/niafrond/niafrond.github.io/commit/d3639aa748d9302a687f5f9386c1de970dcd9da5))
* Enhance combat music system with mood-based tracks and new audio files ([94c9c8c](https://github.com/niafrond/niafrond.github.io/commit/94c9c8ceae66f3a70c8ca44736bbdecd4bc5d06c))
* Enhance enemy selection and AI behavior; add easy enemy option and random move logic ([1a5a50a](https://github.com/niafrond/niafrond.github.io/commit/1a5a50ab0290a398174b36a7a33f47a6f278c424))
* Enhance joker mechanics; add mana gain calculations and tooltip improvements ([266f189](https://github.com/niafrond/niafrond.github.io/commit/266f18919d3eca8b66b4a5b159bda18c9acde7a7))
* Enhance mana management and attribute effects ([cc0bf33](https://github.com/niafrond/niafrond.github.io/commit/cc0bf33884cc8c086bcc1469a2242c32a4c7aeeb))
* Enhance spell effects and enemy profiles; add new items and update inventory mechanics ([dd971f1](https://github.com/niafrond/niafrond.github.io/commit/dd971f12ec5909ec64d24870cc9b21c961cca93a))
* Implement audio management and sound effects; add sound toggle button to UI ([f6a44c4](https://github.com/niafrond/niafrond.github.io/commit/f6a44c4d6407c81b261df51d832c2d468cd0f3dc))
* Implement responsive tile sizing and enhance board layout management ([2aebe3a](https://github.com/niafrond/niafrond.github.io/commit/2aebe3acdbb5786ec996107ae3f6efdf1ffecc27))
* Introduce joker tile mechanics; enhance match detection and spell effects ([6a894c9](https://github.com/niafrond/niafrond.github.io/commit/6a894c9431b40d23a232d34d8756a2c05ff1ffa4))
* Introduire la gestion des tours bonus; refactoriser l'attribution des tours supplémentaires ([dec06b4](https://github.com/niafrond/niafrond.github.io/commit/dec06b4f8f528522863ec30fe466e9d4f9f8c5a9))
* Mettre à jour le système d'expérience avec de nouveaux paramètres et ajouter la gestion des sorts débloqués ([8f25261](https://github.com/niafrond/niafrond.github.io/commit/8f25261ad8e9b534f92cacebab0238c03b2e811c))
* Modifier le déclencheur du workflow pour déployer sur les tags au lieu de la branche principale ([7187ec4](https://github.com/niafrond/niafrond.github.io/commit/7187ec43c0de5a3ef3a4f33e16560532a19c202d))
* Refactor shop functionality; move weapon and item purchasing logic to shop.js and update shop tab display ([3217bfc](https://github.com/niafrond/niafrond.github.io/commit/3217bfc5529370fc2e205b7f79ded9e986128649))
* Supprimer le plugin conventional-changelog-conventionalcommits de la configuration de release ([758e027](https://github.com/niafrond/niafrond.github.io/commit/758e027e9e0204a5ee1033b8a7c8ee5eb59e740c))
* Update board generation logic and enhance tile drop mechanics; include joker tile probabilities and improve match detection ([349d0b2](https://github.com/niafrond/niafrond.github.io/commit/349d0b24054a8c04ad59d62fd4b7a1918fbdb58b))

### Bug Fixes

* repositionner la barre de progression pour respecter les zones de sécurité ([9473ce9](https://github.com/niafrond/niafrond.github.io/commit/9473ce9c8ec448b3932f55a483a8991ceaf9e5bc))
