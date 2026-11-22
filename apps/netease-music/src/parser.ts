import { albumLink, djLink, formatCoverUrl, genreLink, playlistLink, songLink } from "./constants";

export type JsonRecord = Record<string, unknown>;

export interface NcmArtistRef {
  id: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface NcmAlbumRef {
  id: string;
  name: string;
  imageUrl?: string;
  artists: NcmArtistRef[];
  released?: string;
  description?: string;
  trackCount?: number;
  company?: string;
  subType?: string;
}

export interface NcmPlaylistRef {
  id: string;
  name: string;
  imageUrl?: string;
  owner?: string;
  description?: string;
  trackCount?: number;
  tags?: string[];
}

export interface NcmTrackRef {
  id: string;
  name: string;
  artists: NcmArtistRef[];
  album?: { id: string; name: string; imageUrl?: string };
  duration: number;
  imageUrl?: string;
  fee?: number;
  mvId?: number;
}

export interface NcmDjRadioRef {
  id: string;
  name: string;
  imageUrl?: string;
  host?: string;
  category?: string;
  description?: string;
  programCount?: number;
}

export interface NcmDjProgramRef {
  id: string;
  mainSongId: string;
  name: string;
  imageUrl?: string;
  host?: string;
  radioName?: string;
  duration: number;
  description?: string;
}

export interface NcmStyleTagRef {
  tagId: string;
  tagName: string;
  enName?: string;
  imageUrl?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strId(value: unknown): string {
  if (typeof value === "string") {
    return /^\d+$/.test(value.trim()) ? value.trim() : "";
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(Math.floor(value));
  }
  return "";
}

function strText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

export function formatReleaseDate(timestampMs: unknown): string | undefined {
  const ms = numValue(timestampMs);
  if (ms <= 0) {
    return undefined;
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseArtist(raw: unknown): NcmArtistRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = strId(raw.id);
  const name = strText(raw.name);
  if (!name) {
    return null;
  }
  const imageUrl = formatCoverUrl(strText(raw.img1v1Url) || strText(raw.picUrl) || strText(raw.avatarUrl));
  const aliasList = Array.isArray(raw.alias) ? raw.alias.map(strText).filter(Boolean) : [];
  const trans = strText(raw.trans);
  const subtitle = trans || aliasList[0] || undefined;

  return {
    id,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    ...(subtitle ? { subtitle } : {}),
  };
}

export function parseAlbum(raw: unknown): NcmAlbumRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = strId(raw.id);
  const name = strText(raw.name);
  if (!id || !name) {
    return null;
  }
  const rawArtists = Array.isArray(raw.artists) ? raw.artists : raw.artist ? [raw.artist] : [];
  const artists = rawArtists.map(parseArtist).filter((item): item is NcmArtistRef => item !== null);
  const imageUrl = formatCoverUrl(strText(raw.picUrl) || strText(raw.blurPicUrl));
  const released = formatReleaseDate(raw.publishTime);
  const description = strText(raw.description) || undefined;
  const trackCount = numValue(raw.size) || undefined;
  const company = strText(raw.company) || undefined;
  const subType = strText(raw.subType) || undefined;

  return {
    id,
    name,
    artists,
    ...(imageUrl ? { imageUrl } : {}),
    ...(released ? { released } : {}),
    ...(description ? { description } : {}),
    ...(trackCount ? { trackCount } : {}),
    ...(company ? { company } : {}),
    ...(subType ? { subType } : {}),
  };
}

export function parsePlaylist(raw: unknown): NcmPlaylistRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = strId(raw.id);
  const name = strText(raw.name);
  if (!id || !name) {
    return null;
  }
  const imageUrl = formatCoverUrl(strText(raw.coverImgUrl) || strText(raw.picUrl));
  const creator = isRecord(raw.creator) ? raw.creator : undefined;
  const owner = strText(creator?.nickname) || strText(raw.copywriter) || undefined;
  const trackCount = numValue(raw.trackCount) || undefined;
  const tags = Array.isArray(raw.tags) ? raw.tags.map(strText).filter((tag): tag is string => Boolean(tag)) : undefined;

  const descParts: string[] = [];
  const updateFrequency = strText(raw.updateFrequency);
  if (updateFrequency) {
    descParts.push(updateFrequency);
  }
  const rawDesc = strText(raw.description);
  if (rawDesc) {
    descParts.push(rawDesc);
  }
  if (Array.isArray(raw.tracks) && raw.tracks.length) {
    const previewLines = raw.tracks
      .slice(0, 3)
      .map((entry, idx) => {
        if (!isRecord(entry)) return "";
        const first = strText(entry.first);
        const second = strText(entry.second);
        if (!first) return "";
        return second ? `${idx + 1}. ${first} · ${second}` : `${idx + 1}. ${first}`;
      })
      .filter(Boolean);
    if (previewLines.length) {
      descParts.push(previewLines.join("\n"));
    }
  }
  const description = descParts.filter(Boolean).join("\n") || undefined;

  return {
    id,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    ...(owner ? { owner } : {}),
    ...(description ? { description } : {}),
    ...(trackCount ? { trackCount } : {}),
    ...(tags?.length ? { tags } : {}),
  };
}

export function parseTrack(raw: unknown): NcmTrackRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  // Support `/api/personalized/newsong` wrapper `{ id, name, picUrl, song: {...} }`
  const inner = isRecord(raw.song) ? raw.song : raw;
  const id = strId(inner.id) || strId(raw.id);
  const name = strText(inner.name) || strText(raw.name);
  if (!id || !name) {
    return null;
  }

  const rawArtists = Array.isArray(inner.ar)
    ? inner.ar
    : Array.isArray(inner.artists)
      ? inner.artists
      : Array.isArray(raw.ar)
        ? raw.ar
        : [];
  const artists = rawArtists.map(parseArtist).filter((item): item is NcmArtistRef => item !== null);

  const rawAlbum = isRecord(inner.al) ? inner.al : isRecord(inner.album) ? inner.album : undefined;
  const albumId = strId(rawAlbum?.id);
  const albumName = strText(rawAlbum?.name);
  const albumCover = formatCoverUrl(strText(rawAlbum?.picUrl) || strText(raw.picUrl));

  const durationMs = numValue(inner.dt) || numValue(inner.duration);
  const duration = durationMs > 0 ? Math.round(durationMs / 1000) : 0;
  const fee = numValue(inner.fee);
  const mvId = numValue(inner.mv) || numValue(inner.mvid) || numValue(raw.mv) || undefined;

  return {
    id,
    name,
    artists,
    ...(albumName || albumId ? { album: { id: albumId, name: albumName, imageUrl: albumCover } } : {}),
    duration,
    ...(albumCover ? { imageUrl: albumCover } : {}),
    ...(fee ? { fee } : {}),
    ...(mvId && mvId > 0 ? { mvId } : {}),
  };
}

export function parseDjRadio(raw: unknown): NcmDjRadioRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = strId(raw.id);
  const name = strText(raw.name);
  if (!id || !name) {
    return null;
  }
  const imageUrl = formatCoverUrl(strText(raw.picUrl) || strText(raw.intervenePicUrl));
  const dj = isRecord(raw.dj) ? raw.dj : undefined;
  const host = strText(dj?.nickname) || strText(raw.rcmdtext) || strText(raw.rcmdText) || undefined;
  const category = strText(raw.category) || undefined;
  const description = strText(raw.desc) || strText(raw.rcmdText) || strText(raw.rcmdtext) || undefined;
  const programCount = numValue(raw.programCount) || undefined;

  return {
    id,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    ...(host ? { host } : {}),
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(programCount ? { programCount } : {}),
  };
}

export function parseDjProgram(raw: unknown): NcmDjProgramRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const mainSong = isRecord(raw.mainSong) ? raw.mainSong : undefined;
  const mainSongId = strId(mainSong?.id) || strId(raw.mainTrackId);
  const id = strId(raw.id) || mainSongId;
  const name = strText(raw.name) || strText(mainSong?.name);
  if (!mainSongId || !name) {
    return null;
  }
  const imageUrl = formatCoverUrl(strText(raw.coverUrl) || strText(raw.blurCoverUrl));
  const dj = isRecord(raw.dj) ? raw.dj : undefined;
  const radio = isRecord(raw.radio) ? raw.radio : undefined;
  const host = strText(dj?.nickname) || undefined;
  const radioName = strText(radio?.name) || undefined;
  const durationMs = numValue(raw.duration) || numValue(mainSong?.duration);
  const duration = durationMs > 0 ? Math.round(durationMs / 1000) : 0;
  const description = strText(raw.description) || undefined;

  return {
    id,
    mainSongId,
    name,
    ...(imageUrl ? { imageUrl } : {}),
    ...(host ? { host } : {}),
    ...(radioName ? { radioName } : {}),
    duration,
    ...(description ? { description } : {}),
  };
}

export function parseStyleTag(raw: unknown): NcmStyleTagRef | null {
  if (!isRecord(raw)) {
    return null;
  }
  const tagId = strId(raw.tagId);
  const tagName = strText(raw.tagName);
  if (!tagId || !tagName) {
    return null;
  }
  const enName = strText(raw.enName) || undefined;
  const imageUrl = formatCoverUrl(strText(raw.picUrl));
  return {
    tagId,
    tagName,
    ...(enName ? { enName } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function toRexGenreItems(tags?: string[]): GenreItem[] | undefined {
  if (!tags?.length) {
    return undefined;
  }
  const seen = new Set<string>();
  const out: GenreItem[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push({ id: genreLink(trimmed), title: trimmed });
  }
  return out.length ? out : undefined;
}

export function toRexPeoples(artists: NcmArtistRef[]): PersonItem[] | undefined {
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
      role: Widget.i18n("歌手"),
    });
  }
  return peoples.length ? peoples : undefined;
}

export function toRexSong(track: NcmTrackRef): VideoItem {
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

export function toRexAlbum(album: NcmAlbumRef): VideoItem {
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

export function toRexPlaylist(playlist: NcmPlaylistRef): VideoItem {
  const genreItems = toRexGenreItems(playlist.tags);
  return {
    id: playlist.id,
    type: "url",
    mediaType: "playlist",
    link: playlistLink(playlist.id),
    title: playlist.name,
    ...(playlist.owner ? { subtitle: playlist.owner } : {}),
    ...(playlist.imageUrl ? { posterPath: playlist.imageUrl, coverUrl: playlist.imageUrl } : {}),
    ...(playlist.description ? { description: playlist.description } : {}),
    ...(genreItems ? { genreItems } : {}),
  };
}

export function toRexDjRadio(radio: NcmDjRadioRef): VideoItem {
  const subtitleParts = [radio.host || "", radio.category || ""].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || undefined;
  return {
    id: `dj:${radio.id}`,
    type: "url",
    mediaType: "playlist",
    link: djLink(radio.id),
    title: radio.name,
    ...(subtitle ? { subtitle } : {}),
    ...(radio.imageUrl ? { posterPath: radio.imageUrl, coverUrl: radio.imageUrl } : {}),
    ...(radio.description ? { description: radio.description } : {}),
  };
}

export function toRexDjProgram(program: NcmDjProgramRef): VideoItem {
  const subtitleParts = [program.host || "", program.radioName || ""].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || undefined;
  const durationText = formatDuration(program.duration);
  return {
    id: program.mainSongId,
    type: "url",
    mediaType: "song",
    link: songLink(program.mainSongId),
    title: program.name,
    ...(subtitle ? { subtitle } : {}),
    ...(program.imageUrl ? { posterPath: program.imageUrl, coverUrl: program.imageUrl } : {}),
    ...(program.duration > 0 ? { duration: program.duration, durationText } : {}),
    ...(program.description ? { description: program.description } : {}),
  };
}

export function toRexArtist(artist: NcmArtistRef, description?: string): VideoItem {
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
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}
