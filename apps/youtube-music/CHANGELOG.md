# @rexnow/youtube-music

## 0.3.0

### Minor Changes

- 006f3f5: Add YouTube Music native lyrics support via Rex's standalone subtitle entrypoint (`loadSubtitle`), returning synced LRC (when `cueRange` is present) and untimed plain text lyrics (`ANDROID_MUSIC` / `WEB_REMIX`) encoded as UTF-8 base64 `data:` URIs.

## 0.2.1

### Patch Changes

- ffa1717: Support pasting DevTools `Copy as cURL` / Request Headers directly in the Cookie setting (including `x-goog-authuser` and `x-goog-pageid`), validate incomplete cookies in `loadLibrary`, and add a Trusted-Types-safe DevTools Console extraction script to the README.

## 0.2.0

### Minor Changes

- 0032b7d: Add YouTube Music Rex 0.0.7 music widget (`@rexnow/youtube-music`) supporting Home, Charts, New Releases, native Moods & Genres (`musicGenres`), Radio (`musicRadios`), Artists (`musicArtists`), Search, Album/Playlist details, direct VisionOS/iOS audio playback, and optional Cookie-authenticated My Library.
