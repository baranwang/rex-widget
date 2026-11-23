# @rexnow/netease-music

## 0.3.1

### Patch Changes

- f0fd4c6: Fix NetEase Cloud Music playback history scrobbling so played songs appear in Recent Play and Play Record: send sequential `startplay` and `play` EAPI weblog events to `clientlog.music.163.com` using the macOS client profile, normalize `sourceId`/`mainsite`/`mainsiteWeb`/`content`, and await scrobbling in parallel inside `loadSongDetail`.

## 0.3.0

### Minor Changes

- fd46b10: Add Featured Banners (`banners` / `loadBanners`) module supporting user-selectable NetEase client sources (`ipad`, `pc`, `iphone`, `android`), automatic filtering of non-playable web ads, full song/album/playlist/podcast metadata hydration, and wide `backdropPath` artwork.

## 0.2.1

### Patch Changes

- 95cfda3: Populate covers for all curated and high-quality music genre cards (with 24h cache and clean unwatermarked 500x500 artwork), and hydrate missing artist avatars inside genres and radios via Style Hall, Artist List, and batched `/api/batch` lookups (with 7d cache).

## 0.2.0

### Minor Changes

- e1626c5: Enrich NetEase Cloud Music Rex widget based on `NeteaseCloudMusicApi`: add native synced lyrics (`loadSubtitle` with bilingual LRC merging), Podcasts & Radio (`podcasts` + playable `ncm:dj:` episodes), SVIP Hi-Res audio tiers (`jyeffect`/`sky`/`dolby`/`vivid`/`jymaster`), dynamic cover (`albumMotionArtwork`), MV trailers, related songs/playlists, playlist clickable tags, scrobble reporting, Style Hall genres (`musicGenres`), Scene & Running FM (`musicRadios`), Artist charts/filters/biography, expanded My Library tabs, and enhanced Search (lyric search, voice search, and clickable Hot Search).
