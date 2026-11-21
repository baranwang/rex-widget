import {
  type Catalog,
  type CatalogAlbumEntry,
  type CatalogTrackEntry,
  compareNatural,
  formatFileSize,
  loadCatalog,
  normalizeSearchText,
  seeded,
  shuffle,
  todayKey,
} from "./catalog";
import {
  ARTIST_COVER_PATH,
  ARTIST_ID,
  ARTIST_SONGS_PAGE_SIZE,
  albumLink,
  DAILY_PICKS_COUNT,
  DEFAULT_PAGE_SIZE,
  LINK_PREFIX,
  parseDetailLink,
  playlistLink,
  RADIO_PAGE_SIZE,
  RELATED_ALBUMS_LIMIT,
  radioLink,
  resolveAssetUrl,
  resolvePlayerType,
  SEARCH_PAGE_SIZE,
  songLink,
} from "./constants";
import {
  getRadioQueue,
  getRecentTrackIds,
  getRuntimeConfig,
  type RuntimeConfig,
  recordRecentTrack,
  setRadioQueue,
  syncRuntimeConfig,
} from "./storage";

interface CommonGlobalParams {
  language?: string;
  cdnMirror?: string;
  playerType?: string;
}

interface PaginationParams {
  page?: string;
  offset?: string;
}

function parsePage(page?: string): number {
  const parsed = Number(page);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function resolveOffset(params: PaginationParams, pageSize: number): number {
  const offsetRaw = Number(params.offset);
  if (params.offset !== undefined && params.offset !== "" && Number.isFinite(offsetRaw) && offsetRaw >= 0) {
    return Math.floor(offsetRaw);
  }
  return (parsePage(params.page) - 1) * pageSize;
}

function sliceByPage<T>(items: readonly T[], params: PaginationParams, pageSize = DEFAULT_PAGE_SIZE): T[] {
  const offset = resolveOffset(params, pageSize);
  return items.slice(offset, offset + pageSize);
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function getArtistCover(config: RuntimeConfig): string {
  return resolveAssetUrl(ARTIST_COVER_PATH, config.cdnMirror);
}

function getArtistPerson(config: RuntimeConfig): PersonItem {
  return {
    id: ARTIST_ID,
    title: Widget.i18n("李志"),
    avatar: getArtistCover(config),
    role: Widget.i18n("歌手"),
  };
}

function toRexArtist(config: RuntimeConfig, description?: string): VideoItem {
  const cover = getArtistCover(config);
  return {
    id: ARTIST_ID,
    type: "person",
    mediaType: "person",
    title: Widget.i18n("李志"),
    avatar: cover,
    posterPath: cover,
    coverUrl: cover,
    ...(description ? { description } : {}),
  };
}

function toRexAlbum(album: CatalogAlbumEntry, config: RuntimeConfig): VideoItem {
  const artist = getArtistPerson(config);
  const cover = resolveAssetUrl(album.coverPath, config.cdnMirror);
  return {
    id: album.id,
    type: "url",
    mediaType: "album",
    link: albumLink(album.id),
    title: album.name,
    subtitle: `${artist.title} · ${album.ids.length} ${Widget.i18n("首")}`,
    posterPath: cover,
    coverUrl: cover,
    peoples: [artist],
  };
}

function toRexSong(
  track: CatalogTrackEntry,
  config: RuntimeConfig,
  options: { includeAlbumInSubtitle?: boolean } = {},
): VideoItem {
  const artist = getArtistPerson(config);
  const cover = resolveAssetUrl(track.coverPath, config.cdnMirror);
  const subtitle = options.includeAlbumInSubtitle === false ? artist.title : `${artist.title} · ${track.folder}`;
  return {
    id: track.id,
    type: "url",
    mediaType: "song",
    link: songLink(track.id),
    title: track.name,
    subtitle,
    posterPath: cover,
    coverUrl: cover,
    peoples: [artist],
  };
}

function toRexPlaylist(id: string, title: string, subtitle: string, cover: string, description?: string): VideoItem {
  return {
    id,
    type: "url",
    mediaType: "playlist",
    link: playlistLink(id),
    title,
    subtitle,
    posterPath: cover,
    coverUrl: cover,
    ...(description ? { description } : {}),
  };
}

function tracksFromIds(
  catalog: Catalog,
  ids: readonly string[],
  config: RuntimeConfig,
  options?: { includeAlbumInSubtitle?: boolean },
): VideoItem[] {
  const out: VideoItem[] = [];
  for (const id of ids) {
    const entry = catalog.tracks.get(id);
    if (entry) {
      out.push(toRexSong(entry, config, options));
    }
  }
  return out;
}

function allAlbumsFromCatalog(catalog: Catalog, config: RuntimeConfig): VideoItem[] {
  const out: VideoItem[] = [];
  for (const folder of catalog.albumOrder) {
    const album = catalog.albums.get(folder);
    if (album) {
      out.push(toRexAlbum(album, config));
    }
  }
  return out;
}

function getDailyPickIds(catalog: Catalog, date = new Date()): string[] {
  return shuffle(catalog.allTrackIds, seeded(todayKey(date))).slice(0, DAILY_PICKS_COUNT);
}

function buildTodayPlaylistCard(catalog: Catalog, config: RuntimeConfig): VideoItem {
  const pickCount = Math.min(DAILY_PICKS_COUNT, catalog.allTrackIds.length);
  return toRexPlaylist(
    "today",
    Widget.i18n("今天听李志"),
    `${Widget.i18n("随机挑选，每天更新")} · ${pickCount} ${Widget.i18n("首")}`,
    getArtistCover(config),
    Widget.i18n("每日随机挑选 30 首李志曲目，每天更新"),
  );
}

export async function handleHome(
  params: CommonGlobalParams & PaginationParams & { filter?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const filter = (params.filter || "all") as "all" | "picks" | "albums" | "recent";

  if (filter === "picks") {
    const items = tracksFromIds(catalog, getDailyPickIds(catalog), config);
    return sliceByPage(items, params);
  }

  if (filter === "albums") {
    return sliceByPage(allAlbumsFromCatalog(catalog, config), params);
  }

  if (filter === "recent") {
    const items = tracksFromIds(catalog, getRecentTrackIds(), config);
    return sliceByPage(items, params);
  }

  const items: VideoItem[] = [
    buildTodayPlaylistCard(catalog, config),
    ...tracksFromIds(catalog, getDailyPickIds(catalog), config),
    ...allAlbumsFromCatalog(catalog, config),
  ];
  return sliceByPage(items, params);
}

export async function handleAlbums(
  params: CommonGlobalParams & PaginationParams & { sort?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const sort = (params.sort || "default") as "default" | "tracks" | "daily";

  let folders = [...catalog.albumOrder];
  if (sort === "tracks") {
    folders.sort((a, b) => {
      const diff = (catalog.albums.get(b)?.ids.length || 0) - (catalog.albums.get(a)?.ids.length || 0);
      return diff !== 0 ? diff : compareNatural(a, b);
    });
  } else if (sort === "daily") {
    folders = shuffle(folders, seeded(todayKey() + 7));
  }

  const items = folders
    .map((folder) => catalog.albums.get(folder))
    .filter((album): album is CatalogAlbumEntry => Boolean(album))
    .map((album) => toRexAlbum(album, config));
  return sliceByPage(items, params);
}

export async function handleAllSongs(
  params: CommonGlobalParams & PaginationParams & { sort?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const sort = (params.sort || "album") as "album" | "title" | "daily";

  let ids = [...catalog.allTrackIds];
  if (sort === "title") {
    ids.sort((a, b) => {
      const ta = catalog.tracks.get(a);
      const tb = catalog.tracks.get(b);
      const nameDiff = compareNatural(ta?.name || a, tb?.name || b);
      return nameDiff !== 0 ? nameDiff : compareNatural(ta?.folder || "", tb?.folder || "");
    });
  } else if (sort === "daily") {
    ids = shuffle(ids, seeded(todayKey()));
  }

  const items = tracksFromIds(catalog, ids, config);
  return sliceByPage(items, params);
}

export async function handleRadios(
  params: CommonGlobalParams & PaginationParams & { radioId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const rawRadioId = (params.radioId || "").trim();

  if (!rawRadioId) {
    const cover = getArtistCover(config);
    const stations: VideoItem[] = [
      {
        id: "all",
        type: "url",
        mediaType: "radio",
        link: radioLink("all"),
        title: Widget.i18n("随机播放"),
        subtitle: Widget.i18n("全部歌曲，随机顺序"),
        description: Widget.i18n("全部歌曲，随机顺序"),
        posterPath: cover,
        coverUrl: cover,
      },
      {
        id: "today",
        type: "url",
        mediaType: "radio",
        link: radioLink("today"),
        title: Widget.i18n("今天听李志"),
        subtitle: Widget.i18n("随机挑选，每天更新"),
        description: Widget.i18n("每日随机挑选 30 首李志曲目，每天更新"),
        posterPath: cover,
        coverUrl: cover,
      },
    ];
    return sliceByPage(stations, params, RADIO_PAGE_SIZE);
  }

  const radioId = stripPrefix(rawRadioId, LINK_PREFIX.radio);
  const section = params.section || "songs";

  let queueIds: string[];
  if (radioId === "all") {
    const offset = resolveOffset(params, RADIO_PAGE_SIZE);
    const saved = getRadioQueue().filter((id) => catalog.tracks.has(id));
    if (offset === 0 || !saved.length) {
      queueIds = shuffle(catalog.allTrackIds);
      setRadioQueue(queueIds);
    } else {
      queueIds = saved;
    }
  } else if (radioId === "today") {
    queueIds = shuffle(catalog.allTrackIds, seeded(todayKey()));
  } else {
    return [];
  }

  if (section === "artists") {
    return [toRexArtist(config)];
  }

  if (section === "albums") {
    const seen = new Set<string>();
    const albums: VideoItem[] = [];
    for (const id of queueIds) {
      const track = catalog.tracks.get(id);
      if (!track || seen.has(track.folder)) {
        continue;
      }
      seen.add(track.folder);
      const album = catalog.albums.get(track.folder);
      if (album) {
        albums.push(toRexAlbum(album, config));
      }
    }
    return sliceByPage(albums, params, RADIO_PAGE_SIZE);
  }

  const items = tracksFromIds(catalog, queueIds, config);
  return sliceByPage(items, params, RADIO_PAGE_SIZE);
}

export async function handleArtists(
  params: CommonGlobalParams & PaginationParams & { peopleId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const peopleId = (params.peopleId || "").trim();

  const summary = `${catalog.albumOrder.length} ${Widget.i18n("张专辑")} · ${catalog.allTrackIds.length} ${Widget.i18n("首")}`;

  if (!peopleId) {
    return [toRexArtist(config, summary)];
  }

  if (peopleId !== ARTIST_ID) {
    return [];
  }

  if (params.section === "profile") {
    return [toRexArtist(config, `${Widget.i18n("收录 nj-lizhi/song 公开仓库的李志专辑与现场")} · ${summary}`)];
  }

  if (params.section === "artists") {
    return [];
  }

  if (params.section === "albums") {
    return sliceByPage(allAlbumsFromCatalog(catalog, config), params);
  }

  const orderedIds = shuffle(catalog.allTrackIds, seeded(todayKey() + 1));
  const items = tracksFromIds(catalog, orderedIds, config);
  return sliceByPage(items, params, ARTIST_SONGS_PAGE_SIZE);
}

export async function handleRecent(params: CommonGlobalParams & PaginationParams): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const catalog = await loadCatalog(config);
  const items = tracksFromIds(catalog, getRecentTrackIds(), config);
  return sliceByPage(items, params);
}

function matchesArtistName(normalizedQuery: string, localizedArtistName: string): boolean {
  const aliases = ["lizhi", "李志", "li zhi", localizedArtistName];
  return aliases.some((alias) => normalizeSearchText(alias).includes(normalizedQuery));
}

export async function handleSearch(
  params: CommonGlobalParams & PaginationParams & { keyword?: string; kind?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const query = normalizeSearchText(params.keyword || "");
  if (!query) {
    return [];
  }

  const catalog = await loadCatalog(config);
  const kind = (params.kind || "all") as "all" | "songs" | "albums" | "artists";

  const matchedSongs = (): VideoItem[] => {
    const titleMatches: string[] = [];
    const albumOnlyMatches: string[] = [];
    for (const id of catalog.allTrackIds) {
      const track = catalog.tracks.get(id);
      if (!track) {
        continue;
      }
      if (normalizeSearchText(track.name).includes(query)) {
        titleMatches.push(id);
      } else if (normalizeSearchText(track.folder).includes(query)) {
        albumOnlyMatches.push(id);
      }
    }
    return tracksFromIds(catalog, [...titleMatches, ...albumOnlyMatches], config);
  };

  const matchedAlbums = (): VideoItem[] => {
    const out: VideoItem[] = [];
    for (const folder of catalog.albumOrder) {
      const album = catalog.albums.get(folder);
      if (album && normalizeSearchText(album.name).includes(query)) {
        out.push(toRexAlbum(album, config));
      }
    }
    return out;
  };

  const matchedArtists = (): VideoItem[] => {
    const artistName = Widget.i18n("李志");
    if (!matchesArtistName(query, artistName)) {
      return [];
    }
    return [toRexArtist(config)];
  };

  if (kind === "songs") {
    return sliceByPage(matchedSongs(), params, SEARCH_PAGE_SIZE);
  }
  if (kind === "albums") {
    return sliceByPage(matchedAlbums(), params, SEARCH_PAGE_SIZE);
  }
  if (kind === "artists") {
    return sliceByPage(matchedArtists(), params, SEARCH_PAGE_SIZE);
  }

  const combined = [...matchedArtists(), ...matchedAlbums(), ...matchedSongs()];
  return sliceByPage(combined, params, SEARCH_PAGE_SIZE);
}

function loadSongDetail(catalog: Catalog, songId: string, config: RuntimeConfig): VideoItem {
  const track = catalog.tracks.get(songId);
  if (!track) {
    throw new Error(`${Widget.i18n("未找到歌曲")}: ${songId}`);
  }

  recordRecentTrack(track.id);

  const artist = getArtistPerson(config);
  const cover = resolveAssetUrl(track.coverPath, config.cdnMirror);
  const audioUrl = resolveAssetUrl(track.id, config.cdnMirror, track.size);
  const playerType = resolvePlayerType(config.playerType, track.ext);
  const sizeText = formatFileSize(track.size);
  const metaParts = [track.folder, track.ext.toUpperCase(), ...(sizeText ? [sizeText] : [])];

  return {
    id: track.id,
    type: "url",
    mediaType: "song",
    link: songLink(track.id),
    title: track.name,
    subtitle: `${artist.title} · ${track.folder}`,
    posterPath: cover,
    coverUrl: cover,
    peoples: [artist],
    description: metaParts.join(" · "),
    videoUrl: audioUrl,
    ...(playerType ? { playerType } : {}),
  };
}

function loadAlbumDetail(catalog: Catalog, albumId: string, config: RuntimeConfig): VideoItem {
  const album = catalog.albums.get(albumId);
  if (!album) {
    throw new Error(`${Widget.i18n("未找到专辑")}: ${albumId}`);
  }

  const artist = getArtistPerson(config);
  const cover = resolveAssetUrl(album.coverPath, config.cdnMirror);
  const tracks = tracksFromIds(catalog, album.ids, config, { includeAlbumInSubtitle: false });

  const idx = catalog.albumOrder.indexOf(album.id);
  const rotated =
    idx >= 0
      ? [...catalog.albumOrder.slice(idx + 1), ...catalog.albumOrder.slice(0, idx)]
      : catalog.albumOrder.filter((folder) => folder !== album.id);
  const relatedItems = rotated
    .slice(0, RELATED_ALBUMS_LIMIT)
    .map((folder) => catalog.albums.get(folder))
    .filter((entry): entry is CatalogAlbumEntry => Boolean(entry))
    .map((entry) => toRexAlbum(entry, config));

  return {
    id: album.id,
    type: "url",
    mediaType: "album",
    link: albumLink(album.id),
    title: album.name,
    subtitle: artist.title,
    posterPath: cover,
    coverUrl: cover,
    peoples: [artist],
    description: `${artist.title} · ${album.ids.length} ${Widget.i18n("首")}`,
    tracks,
    ...(relatedItems.length ? { relatedItems } : {}),
  };
}

function loadPlaylistDetail(catalog: Catalog, playlistId: string, config: RuntimeConfig): VideoItem {
  const cover = getArtistCover(config);
  const artist = getArtistPerson(config);

  if (playlistId === "today") {
    const ids = getDailyPickIds(catalog);
    const tracks = tracksFromIds(catalog, ids, config);
    return {
      id: "today",
      type: "url",
      mediaType: "playlist",
      link: playlistLink("today"),
      title: Widget.i18n("今天听李志"),
      subtitle: `${Widget.i18n("随机挑选，每天更新")} · ${tracks.length} ${Widget.i18n("首")}`,
      posterPath: cover,
      coverUrl: cover,
      peoples: [artist],
      description: Widget.i18n("每日随机挑选 30 首李志曲目，每天更新"),
      tracks,
    };
  }

  if (playlistId === "all") {
    const tracks = tracksFromIds(catalog, catalog.allTrackIds, config);
    return {
      id: "all",
      type: "url",
      mediaType: "playlist",
      link: playlistLink("all"),
      title: Widget.i18n("全部歌曲"),
      subtitle: `${artist.title} · ${tracks.length} ${Widget.i18n("首")}`,
      posterPath: cover,
      coverUrl: cover,
      peoples: [artist],
      description: Widget.i18n("收录 nj-lizhi/song 公开仓库的李志专辑与现场"),
      tracks,
    };
  }

  if (playlistId === "recent") {
    const tracks = tracksFromIds(catalog, getRecentTrackIds(), config);
    return {
      id: "recent",
      type: "url",
      mediaType: "playlist",
      link: playlistLink("recent"),
      title: Widget.i18n("最近播放"),
      subtitle: `${artist.title} · ${tracks.length} ${Widget.i18n("首")}`,
      posterPath: cover,
      coverUrl: cover,
      peoples: [artist],
      description: Widget.i18n("本机收听历史记录"),
      tracks,
    };
  }

  throw new Error(`${Widget.i18n("未找到歌单")}: ${playlistId}`);
}

export async function handleDetail(link: string): Promise<VideoItem> {
  const parsed = parseDetailLink(link);
  if (!parsed) {
    throw new Error(`${Widget.i18n("无法识别的详情链接")}: ${link}`);
  }
  const config = getRuntimeConfig();
  const catalog = await loadCatalog(config);

  if (parsed.kind === "song") {
    return loadSongDetail(catalog, parsed.id, config);
  }
  if (parsed.kind === "album") {
    return loadAlbumDetail(catalog, parsed.id, config);
  }
  return loadPlaylistDetail(catalog, parsed.id, config);
}
