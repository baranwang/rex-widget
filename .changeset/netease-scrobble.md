---
"@rexnow/netease-music": patch
---

Fix NetEase Cloud Music playback history scrobbling so played songs appear in Recent Play and Play Record: send sequential `startplay` and `play` EAPI weblog events to `clientlog.music.163.com` using the macOS client profile, normalize `sourceId`/`mainsite`/`mainsiteWeb`/`content`, and await scrobbling in parallel inside `loadSongDetail`.
