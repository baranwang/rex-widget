# @rexnow/netease-music

## 0.2.1

### Patch Changes

- 95cfda3: Populate covers for all curated and high-quality music genre cards (with 24h cache and clean unwatermarked 500x500 artwork), and hydrate missing artist avatars inside genres and radios via Style Hall, Artist List, and batched `/api/batch` lookups (with 7d cache).

## 0.2.0

### Minor Changes

- e1626c5: Enrich NetEase Cloud Music Rex widget based on `NeteaseCloudMusicApi`: add native synced lyrics (`loadSubtitle` with bilingual LRC merging), Podcasts & Radio (`podcasts` + playable `ncm:dj:` episodes), SVIP Hi-Res audio tiers (`jyeffect`/`sky`/`dolby`/`vivid`/`jymaster`), dynamic cover (`albumMotionArtwork`), MV trailers, related songs/playlists, playlist clickable tags, scrobble reporting, Style Hall genres (`musicGenres`), Scene & Running FM (`musicRadios`), Artist charts/filters/biography, expanded My Library tabs, and enhanced Search (lyric search, voice search, and clickable Hot Search).
