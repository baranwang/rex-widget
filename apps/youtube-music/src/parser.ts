import { albumLink, plainPlaylistId, playlistLink, songLink } from "./constants";

export type JsonRecord = Record<string, unknown>;

export interface YtmArtistRef {
  id: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface YtmAlbumRef {
  id: string;
  name: string;
  imageUrl?: string;
  artists: YtmArtistRef[];
  released?: string;
}

export interface YtmPlaylistRef {
  id: string;
  name: string;
  imageUrl?: string;
  owner?: string;
}

export interface YtmTrackRef {
  id: string;
  name: string;
  artists: YtmArtistRef[];
  album?: { id: string; name: string; imageUrl?: string };
  duration: number;
  imageUrl?: string;
  unavailable?: boolean;
}

export interface YtmGenreButton {
  id: string;
  title: string;
  browseId: string;
  params: string;
}

export type YtmParsedItem =
  | { kind: "track"; value: YtmTrackRef }
  | { kind: "album"; value: YtmAlbumRef }
  | { kind: "artist"; value: YtmArtistRef }
  | { kind: "playlist"; value: YtmPlaylistRef };

export interface YtmSection {
  title: string;
  tracks: YtmTrackRef[];
  albums: YtmAlbumRef[];
  artists: YtmArtistRef[];
  playlists: YtmPlaylistRef[];
  browseId?: string;
  browseParams?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function findAll<T = JsonRecord>(node: unknown, name: string, out: T[] = []): T[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      findAll(item, name, out);
    }
  } else if (isRecord(node)) {
    for (const key of Object.keys(node)) {
      if (key === name) {
        out.push(node[key] as T);
      } else {
        findAll(node[key], name, out);
      }
    }
  }
  return out;
}

export function findOne<T = JsonRecord>(node: unknown, name: string): T | undefined {
  return findAll<T>(node, name)[0];
}

export function textOf(node: unknown): string {
  if (!isRecord(node)) {
    return "";
  }
  if (typeof node.simpleText === "string") {
    return node.simpleText;
  }
  if (Array.isArray(node.runs)) {
    return node.runs.map((run) => (isRecord(run) && typeof run.text === "string" ? run.text : "")).join("");
  }
  return "";
}

export function imageOf(node: unknown): string | undefined {
  if (!node) {
    return undefined;
  }
  const list = findOne<unknown[]>(node, "thumbnails");
  if (!Array.isArray(list) || !list.length) {
    return undefined;
  }
  const last = list[list.length - 1];
  const url = isRecord(last) && typeof last.url === "string" ? last.url : "";
  if (!url) {
    return undefined;
  }
  return url.replace(/=w\d+-h\d+[^/]*$/, "=w544-h544-l90-rj");
}

export function secondsOf(text: string): number {
  const trimmed = (text || "").trim();
  if (!trimmed || !/^\d+(:\d{1,2})+$/.test(trimmed)) {
    return 0;
  }
  return trimmed.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function pageTypeOf(nav: unknown): string {
  if (!isRecord(nav)) return "";
  const browseEndpoint = nav.browseEndpoint;
  if (!isRecord(browseEndpoint)) return "";
  const configs = browseEndpoint.browseEndpointContextSupportedConfigs;
  if (!isRecord(configs)) return "";
  const musicConfig = configs.browseEndpointContextMusicConfig;
  if (!isRecord(musicConfig)) return "";
  return typeof musicConfig.pageType === "string" ? musicConfig.pageType : "";
}

const SKIPPED_PAGE_TYPES = new Set([
  "MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE",
  "MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE",
]);

const GENERIC_KIND_LABELS = new Set([
  "song",
  "video",
  "album",
  "single",
  "ep",
  "playlist",
  "artist",
  "podcast",
  "episode",
  "歌曲",
  "视频",
  "影片",
  "专辑",
  "專輯",
  "单曲",
  "單曲",
  "播放列表",
  "播放清單",
  "歌单",
  "歌單",
  "音乐人",
  "音樂人",
  "艺人",
  "藝人",
  "歌手",
]);

function isMetaNoiseText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^\s*[•·,&]\s*$/.test(trimmed)) return true;
  if (GENERIC_KIND_LABELS.has(trimmed.toLowerCase())) return true;
  if (/(?:views|plays|subscribers|songs|tracks|次观看|次觀看|次播放|位订阅者|位訂閱者|首歌曲)/i.test(trimmed)) {
    return true;
  }
  return false;
}

interface ParsedCredits {
  artists: YtmArtistRef[];
  album: { id: string; name: string } | null;
  duration: number;
  names: string[];
  rawTexts: string[];
}

export function creditsOf(runs: unknown): ParsedCredits {
  const out: ParsedCredits = { artists: [], album: null, duration: 0, names: [], rawTexts: [] };
  if (!Array.isArray(runs)) {
    return out;
  }
  for (const run of runs) {
    if (!isRecord(run)) continue;
    const text = typeof run.text === "string" ? run.text.trim() : "";
    if (!text || /^\s*[•·,&]\s*$/.test(text)) continue;
    out.rawTexts.push(text);
    const nav = run.navigationEndpoint;
    const type = pageTypeOf(nav);
    const browseId =
      isRecord(nav) && isRecord(nav.browseEndpoint) && typeof nav.browseEndpoint.browseId === "string"
        ? nav.browseEndpoint.browseId
        : "";

    if ((type === "MUSIC_PAGE_TYPE_ARTIST" || type === "MUSIC_PAGE_TYPE_USER_CHANNEL") && browseId) {
      out.artists.push({ id: browseId, name: text });
    } else if ((type === "MUSIC_PAGE_TYPE_ALBUM" || type === "MUSIC_PAGE_TYPE_AUDIOBOOK") && browseId) {
      out.album = { id: browseId, name: text };
    } else {
      const secs = secondsOf(text);
      if (secs > 0) {
        out.duration = secs;
      } else if (!isMetaNoiseText(text)) {
        out.names.push(text);
      }
    }
  }
  return out;
}

function trackFrom(
  id: string,
  name: string,
  credits: ParsedCredits,
  image?: string,
  unavailable?: boolean,
): YtmTrackRef {
  const artists = credits.artists.length
    ? credits.artists
    : credits.names.slice(0, 1).map((artistName) => ({ id: "", name: artistName }));
  return {
    id,
    name,
    artists,
    album: credits.album ? { ...credits.album, imageUrl: image } : undefined,
    duration: credits.duration,
    imageUrl: image,
    unavailable: unavailable || undefined,
  };
}

export function collectionOf(nav: unknown, name: string, runs: unknown, image?: string): YtmParsedItem | null {
  if (!isRecord(nav) || !isRecord(nav.browseEndpoint)) {
    return null;
  }
  const id = typeof nav.browseEndpoint.browseId === "string" ? nav.browseEndpoint.browseId : "";
  if (!id || !name) {
    return null;
  }
  const type = pageTypeOf(nav);
  if (SKIPPED_PAGE_TYPES.has(type)) {
    return null;
  }
  const credits = creditsOf(runs);

  switch (type) {
    case "MUSIC_PAGE_TYPE_ARTIST":
    case "MUSIC_PAGE_TYPE_USER_CHANNEL": {
      const subscriberText = credits.rawTexts.find((t) => /(?:subscriber|订阅|訂閱|monthly)/i.test(t));
      return {
        kind: "artist",
        value: { id, name, imageUrl: image, ...(subscriberText ? { subtitle: subscriberText } : {}) },
      };
    }
    case "MUSIC_PAGE_TYPE_ALBUM":
    case "MUSIC_PAGE_TYPE_AUDIOBOOK": {
      const released = credits.rawTexts.find((t) => /^\d{4}$/.test(t));
      return {
        kind: "album",
        value: {
          id,
          name,
          imageUrl: image,
          artists: credits.artists.length
            ? credits.artists
            : credits.names
                .filter((n) => !/^\d{4}$/.test(n))
                .slice(0, 1)
                .map((n) => ({ id: "", name: n })),
          released,
        },
      };
    }
    case "MUSIC_PAGE_TYPE_PLAYLIST": {
      const plainId = plainPlaylistId(id);
      if (!plainId) return null;
      return {
        kind: "playlist",
        value: {
          id: plainId,
          name,
          imageUrl: image,
          owner: credits.artists[0]?.name || credits.names[0] || "",
        },
      };
    }
    default:
      return null;
  }
}

function getWatchVideoId(nav: unknown): string {
  if (!isRecord(nav) || !isRecord(nav.watchEndpoint)) {
    return "";
  }
  return typeof nav.watchEndpoint.videoId === "string" ? nav.watchEndpoint.videoId : "";
}

function isPodcastWatchEndpoint(nav: unknown): boolean {
  if (!isRecord(nav) || !isRecord(nav.watchEndpoint)) {
    return false;
  }
  const musicConfig = isRecord(nav.watchEndpoint.watchEndpointMusicSupportedConfigs)
    ? nav.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig
    : undefined;
  if (!isRecord(musicConfig)) {
    return false;
  }
  const videoType = typeof musicConfig.musicVideoType === "string" ? musicConfig.musicVideoType : "";
  return videoType === "MUSIC_VIDEO_TYPE_PODCAST_EPISODE";
}

export function rowOf(renderer: JsonRecord): YtmParsedItem | null {
  const flexCols = Array.isArray(renderer.flexColumns) ? renderer.flexColumns : [];
  const columns = flexCols.map((col) =>
    isRecord(col) && isRecord(col.musicResponsiveListItemFlexColumnRenderer)
      ? col.musicResponsiveListItemFlexColumnRenderer.text
      : undefined,
  );
  const name = textOf(columns[0]);
  const firstColRuns = isRecord(columns[0]) && Array.isArray(columns[0].runs) ? columns[0].runs : [];
  const firstNav = isRecord(firstColRuns[0]) ? firstColRuns[0].navigationEndpoint : undefined;
  const playlistItemData = isRecord(renderer.playlistItemData) ? renderer.playlistItemData : undefined;
  const videoId =
    (typeof playlistItemData?.videoId === "string" ? playlistItemData.videoId : "") || getWatchVideoId(firstNav);

  const runs: unknown[] = [];
  for (const col of columns.slice(1)) {
    if (isRecord(col) && Array.isArray(col.runs)) {
      runs.push(...col.runs, { text: "•" });
    }
  }

  const fixedCols = Array.isArray(renderer.fixedColumns) ? renderer.fixedColumns : [];
  const fixedTexts = fixedCols.map((col) =>
    isRecord(col) && isRecord(col.musicResponsiveListItemFixedColumnRenderer)
      ? textOf(col.musicResponsiveListItemFixedColumnRenderer.text)
      : "",
  );

  const credits = creditsOf(runs);
  if (!credits.duration && fixedTexts[0]) {
    credits.duration = secondsOf(fixedTexts[0]);
  }
  const image = imageOf(renderer.thumbnail);

  if (videoId && name) {
    if (isPodcastWatchEndpoint(firstNav)) {
      return null;
    }
    const unavailable = renderer.musicItemRendererDisplayPolicy === "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT";
    return { kind: "track", value: trackFrom(videoId, name, credits, image, unavailable) };
  }

  return collectionOf(renderer.navigationEndpoint || firstNav, name, runs, image);
}

export function cardOf(renderer: JsonRecord): YtmParsedItem | null {
  const name = textOf(renderer.title);
  const runs = isRecord(renderer.subtitle) && Array.isArray(renderer.subtitle.runs) ? renderer.subtitle.runs : [];
  const image = imageOf(renderer.thumbnailRenderer);
  const nav = renderer.navigationEndpoint;
  const videoId = getWatchVideoId(nav);

  if (videoId && name) {
    if (isPodcastWatchEndpoint(nav)) {
      return null;
    }
    const credits = creditsOf(runs);
    return { kind: "track", value: trackFrom(videoId, name, credits, image) };
  }

  return collectionOf(nav, name, runs, image);
}

export function cardShelfOf(renderer: JsonRecord): YtmParsedItem[] {
  const out: YtmParsedItem[] = [];
  const name = textOf(renderer.title);
  const subtitleRuns =
    isRecord(renderer.subtitle) && Array.isArray(renderer.subtitle.runs) ? renderer.subtitle.runs : [];
  const image = imageOf(renderer.thumbnail);
  const titleRuns = isRecord(renderer.title) && Array.isArray(renderer.title.runs) ? renderer.title.runs : [];
  const nav = (isRecord(titleRuns[0]) ? titleRuns[0].navigationEndpoint : undefined) || renderer.onTap;

  const videoId = getWatchVideoId(nav);
  if (videoId && name && !isPodcastWatchEndpoint(nav)) {
    out.push({ kind: "track", value: trackFrom(videoId, name, creditsOf(subtitleRuns), image) });
  } else {
    const col = collectionOf(nav, name, subtitleRuns, image);
    if (col) {
      out.push(col);
    }
  }

  if (Array.isArray(renderer.contents)) {
    out.push(...itemsOf(renderer.contents));
  }
  return out;
}

export function itemsOf(list: unknown): YtmParsedItem[] {
  const out: YtmParsedItem[] = [];
  if (!Array.isArray(list)) {
    return out;
  }
  for (const item of list) {
    if (!isRecord(item)) continue;
    if (isRecord(item.musicResponsiveListItemRenderer)) {
      const got = rowOf(item.musicResponsiveListItemRenderer);
      if (got) out.push(got);
    } else if (isRecord(item.musicTwoRowItemRenderer)) {
      const got = cardOf(item.musicTwoRowItemRenderer);
      if (got) out.push(got);
    }
  }
  return out;
}

type YtmItemByKind = {
  track: YtmTrackRef;
  album: YtmAlbumRef;
  artist: YtmArtistRef;
  playlist: YtmPlaylistRef;
};

export function ofKind<K extends keyof YtmItemByKind>(items: YtmParsedItem[], kind: K): Array<YtmItemByKind[K]> {
  const out: Array<YtmItemByKind[K]> = [];
  for (const item of items) {
    if (item.kind === kind) {
      out.push(item.value as YtmItemByKind[K]);
    }
  }
  return out;
}

export function shelfTitle(shelf: JsonRecord): string {
  return textOf(shelf.title) || textOf(findOne(shelf.header, "title"));
}

function shelfBrowseEndpoint(shelf: JsonRecord): { browseId?: string; browseParams?: string } {
  const header = shelf.header;
  const endpoint =
    findOne<JsonRecord>(header, "browseEndpoint") || findOne<JsonRecord>(shelf.bottomEndpoint, "browseEndpoint");
  if (!isRecord(endpoint)) {
    return {};
  }
  return {
    browseId: typeof endpoint.browseId === "string" ? endpoint.browseId : undefined,
    browseParams: typeof endpoint.params === "string" ? endpoint.params : undefined,
  };
}

export function sectionsOf(answer: unknown): YtmSection[] {
  const sections: YtmSection[] = [];
  const lists = [
    ...findAll<JsonRecord>(answer, "sectionListRenderer"),
    ...findAll<JsonRecord>(answer, "sectionListContinuation"),
  ];

  for (const list of lists) {
    const contents = Array.isArray(list.contents) ? list.contents : [];
    for (const entry of contents) {
      if (!isRecord(entry)) continue;

      if (isRecord(entry.musicCardShelfRenderer)) {
        const items = cardShelfOf(entry.musicCardShelfRenderer);
        if (items.length) {
          sections.push({
            title: shelfTitle(entry.musicCardShelfRenderer) || "Top Result",
            tracks: ofKind(items, "track"),
            albums: ofKind(items, "album"),
            artists: ofKind(items, "artist"),
            playlists: ofKind(items, "playlist"),
          });
        }
        continue;
      }

      if (isRecord(entry.itemSectionRenderer)) {
        const items = itemsOf(entry.itemSectionRenderer.contents);
        if (items.length) {
          sections.push({
            title: "",
            tracks: ofKind(items, "track"),
            albums: ofKind(items, "album"),
            artists: ofKind(items, "artist"),
            playlists: ofKind(items, "playlist"),
          });
        }
        continue;
      }

      const shelf =
        (isRecord(entry.musicCarouselShelfRenderer) && entry.musicCarouselShelfRenderer) ||
        (isRecord(entry.musicShelfRenderer) && entry.musicShelfRenderer) ||
        (isRecord(entry.musicPlaylistShelfRenderer) && entry.musicPlaylistShelfRenderer) ||
        (isRecord(entry.gridRenderer) && entry.gridRenderer) ||
        null;

      if (!shelf) continue;
      const items = itemsOf(shelf.contents || shelf.items);
      if (!items.length) continue;

      const endpoint = shelfBrowseEndpoint(shelf);
      sections.push({
        title: shelfTitle(shelf),
        tracks: ofKind(items, "track"),
        albums: ofKind(items, "album"),
        artists: ofKind(items, "artist"),
        playlists: ofKind(items, "playlist"),
        ...endpoint,
      });
    }
  }
  return sections;
}

export function extractGenreButtons(answer: unknown): YtmGenreButton[] {
  const seen = new Set<string>();
  const buttons: YtmGenreButton[] = [];
  for (const renderer of findAll<JsonRecord>(answer, "musicNavigationButtonRenderer")) {
    const title = textOf(renderer.buttonText);
    const clickCommand = isRecord(renderer.clickCommand) ? renderer.clickCommand : undefined;
    const endpoint = clickCommand && isRecord(clickCommand.browseEndpoint) ? clickCommand.browseEndpoint : undefined;
    const browseId = typeof endpoint?.browseId === "string" ? endpoint.browseId : "";
    const params = typeof endpoint?.params === "string" ? endpoint.params : "";
    if (!title || browseId !== "FEmusic_moods_and_genres_category" || !params || seen.has(params)) {
      continue;
    }
    seen.add(params);
    buttons.push({
      id: params,
      title,
      browseId,
      params,
    });
  }
  return buttons;
}

export function nextToken(node: unknown): string {
  if (!node) return "";
  const old = findOne<JsonRecord>(node, "nextContinuationData");
  if (typeof old?.continuation === "string" && old.continuation) {
    return old.continuation;
  }
  const command = findOne<JsonRecord>(node, "continuationCommand");
  return typeof command?.token === "string" ? command.token : "";
}

export function rowsOf(answer: unknown): { items: YtmParsedItem[]; token: string } {
  const further =
    findOne<JsonRecord>(answer, "onResponseReceivedActions") ||
    findOne<JsonRecord>(answer, "musicShelfContinuation") ||
    findOne<JsonRecord>(answer, "musicPlaylistShelfContinuation");
  if (further) {
    const continuationLists = findAll<unknown[]>(further, "continuationItems");
    const list = continuationLists[0] || further.contents || [];
    return { items: itemsOf(list), token: nextToken(further) };
  }
  const shelf =
    findOne<JsonRecord>(answer, "musicPlaylistShelfRenderer") || findOne<JsonRecord>(answer, "musicShelfRenderer");
  return { items: itemsOf(shelf?.contents), token: nextToken(shelf) };
}

export function panelTrackOf(renderer: JsonRecord): YtmTrackRef | null {
  const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
  const name = textOf(renderer.title);
  if (!videoId || !name) {
    return null;
  }
  const bylineRuns =
    isRecord(renderer.longBylineText) && Array.isArray(renderer.longBylineText.runs)
      ? renderer.longBylineText.runs
      : isRecord(renderer.shortBylineText) && Array.isArray(renderer.shortBylineText.runs)
        ? renderer.shortBylineText.runs
        : [];
  const credits = creditsOf(bylineRuns);
  credits.duration = secondsOf(textOf(renderer.lengthText));
  return trackFrom(videoId, name, credits, imageOf(renderer.thumbnail));
}

export function headerOf(answer: unknown): JsonRecord {
  return (
    findOne<JsonRecord>(answer, "musicResponsiveHeaderRenderer") ||
    findOne<JsonRecord>(answer, "musicDetailHeaderRenderer") ||
    {}
  );
}

export function toRexPeoples(artists: YtmArtistRef[]): PersonItem[] | undefined {
  const seen = new Set<string>();
  const peoples: PersonItem[] = [];
  for (const artist of artists) {
    if (!artist.id || !artist.name || seen.has(artist.id)) {
      continue;
    }
    seen.add(artist.id);
    peoples.push({
      id: artist.id,
      title: artist.name,
      ...(artist.imageUrl ? { avatar: artist.imageUrl } : {}),
      role: "歌手",
    });
  }
  return peoples.length ? peoples : undefined;
}

export function toRexSong(track: YtmTrackRef): VideoItem {
  const artistNames = track.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join(" / ");
  const subtitle = artistNames || track.album?.name || undefined;
  const cover = track.imageUrl || track.album?.imageUrl;
  const peoples = toRexPeoples(track.artists);
  const durationText = formatDuration(track.duration);

  return {
    id: track.id,
    type: "url",
    mediaType: "song",
    link: songLink(track.id),
    title: track.name,
    ...(subtitle ? { subtitle } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(track.duration > 0 ? { duration: track.duration, durationText } : {}),
    ...(peoples ? { peoples } : {}),
  };
}

export function toRexAlbum(album: YtmAlbumRef): VideoItem {
  const artistNames = album.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join(" / ");
  const peoples = toRexPeoples(album.artists);

  return {
    id: album.id,
    type: "url",
    mediaType: "album",
    link: albumLink(album.id),
    title: album.name,
    ...(artistNames ? { subtitle: artistNames } : {}),
    ...(album.imageUrl ? { posterPath: album.imageUrl, coverUrl: album.imageUrl } : {}),
    ...(album.released ? { releaseDate: album.released } : {}),
    ...(peoples ? { peoples } : {}),
  };
}

export function toRexPlaylist(playlist: YtmPlaylistRef): VideoItem {
  const id = plainPlaylistId(playlist.id);
  return {
    id,
    type: "url",
    mediaType: "playlist",
    link: playlistLink(id),
    title: playlist.name,
    ...(playlist.owner ? { subtitle: playlist.owner } : {}),
    ...(playlist.imageUrl ? { posterPath: playlist.imageUrl, coverUrl: playlist.imageUrl } : {}),
  };
}

export function toRexArtist(artist: YtmArtistRef, description?: string): VideoItem {
  return {
    id: artist.id,
    type: "person",
    mediaType: "person",
    title: artist.name,
    ...(artist.subtitle ? { subtitle: artist.subtitle } : {}),
    ...(artist.imageUrl ? { avatar: artist.imageUrl, posterPath: artist.imageUrl, coverUrl: artist.imageUrl } : {}),
    ...(description ? { description } : {}),
  };
}

export function dedupeVideoItems(items: VideoItem[]): VideoItem[] {
  const seen = new Set<string>();
  const out: VideoItem[] = [];
  for (const item of items) {
    const key = `${item.mediaType || item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
