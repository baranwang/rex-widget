import { parseCookieAuthInput } from "./auth";
import { eapiRequest, fetchSongDetails, resolveAccountUid, resolveAudioStream, webRequest } from "./client";
import {
  CURATED_GENRES,
  DEFAULT_PAGE_SIZE,
  formatCoverUrl,
  genreLink,
  isValidNumericId,
  LINK_PREFIX,
  MAX_PLAYLIST_TRACKS,
  NEW_SONG_AREA_IDS,
  PRIVATE_RADAR_PLAYLIST_ID,
  parseDetailLink,
  playlistLink,
  type ReleaseArea,
  radioLink,
  resolvePlayerType,
  SEARCH_TYPE_CODES,
  type SearchKind,
  songLink,
} from "./constants";
import {
  dedupeVideoItems,
  formatDuration,
  type JsonRecord,
  type NcmAlbumRef,
  type NcmArtistRef,
  type NcmPlaylistRef,
  type NcmTrackRef,
  parseAlbum,
  parseArtist,
  parsePlaylist,
  parseTrack,
  toRexAlbum,
  toRexArtist,
  toRexPeoples,
  toRexPlaylist,
  toRexSong,
} from "./parser";
import {
  cacheSongMetaList,
  getCachedSongMeta,
  getRuntimeConfig,
  type RuntimeConfig,
  syncRuntimeConfig,
} from "./storage";

interface CommonGlobalParams {
  cookie?: string;
  quality?: string;
  allowTrial?: string;
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

function resolveOffset(params: PaginationParams, pageSize = DEFAULT_PAGE_SIZE): number {
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

function normalizeReleaseArea(value?: string): ReleaseArea {
  if (value === "ZH" || value === "EA" || value === "KR" || value === "JP") {
    return value;
  }
  return "ALL";
}

async function fetchPlaylistTracks(
  playlistId: string,
  config: RuntimeConfig,
  limit = MAX_PLAYLIST_TRACKS,
): Promise<{ playlist: NcmPlaylistRef; tracks: NcmTrackRef[] }> {
  const response = await webRequest<{
    playlist?: JsonRecord & {
      tracks?: unknown[];
      trackIds?: Array<{ id?: number | string }>;
    };
  }>("/api/v6/playlist/detail", { id: playlistId, n: 100000, s: 0 }, config, { method: "POST" });

  const rawPlaylist = response.playlist;
  const playlist = parsePlaylist(rawPlaylist) ?? {
    id: playlistId,
    name: playlistId,
  };

  const inlineTracks = (Array.isArray(rawPlaylist?.tracks) ? rawPlaylist.tracks : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null);
  const inlineMap = new Map<string, NcmTrackRef>(inlineTracks.map((t) => [t.id, t]));

  const trackIds = (Array.isArray(rawPlaylist?.trackIds) ? rawPlaylist.trackIds : [])
    .map((entry) => (entry?.id !== undefined ? String(entry.id) : ""))
    .filter((id) => isValidNumericId(id))
    .slice(0, limit);

  if (!trackIds.length) {
    return { playlist, tracks: inlineTracks.slice(0, limit) };
  }

  const missingIds = trackIds.filter((id) => !inlineMap.has(id));
  if (missingIds.length) {
    const fetched = await fetchSongDetails(missingIds, config);
    for (const track of fetched) {
      inlineMap.set(track.id, track);
    }
  }

  const ordered: NcmTrackRef[] = [];
  for (const id of trackIds) {
    const track = inlineMap.get(id);
    if (track) {
      ordered.push(track);
    }
  }
  return { playlist, tracks: ordered };
}

export async function handleHome(
  params: CommonGlobalParams & PaginationParams & { filter?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const filter = (params.filter || "all") as "all" | "daily" | "songs" | "playlists";
  const hasCookie = parseCookieAuthInput(config.cookie).hasMusicU;

  if (filter === "daily") {
    const response = await webRequest<{ data?: { dailySongs?: unknown[] } }>(
      "/api/v3/discovery/recommend/songs",
      {},
      config,
    );
    const tracks = (Array.isArray(response.data?.dailySongs) ? response.data.dailySongs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }

  const tasks: {
    dailySongs?: Promise<NcmTrackRef[]>;
    dailyPlaylists?: Promise<NcmPlaylistRef[]>;
    recommendedPlaylists?: Promise<NcmPlaylistRef[]>;
    newSongs?: Promise<NcmTrackRef[]>;
  } = {};

  if (filter === "all" || filter === "songs") {
    if (hasCookie) {
      tasks.dailySongs = webRequest<{ data?: { dailySongs?: unknown[] } }>(
        "/api/v3/discovery/recommend/songs",
        {},
        config,
      ).then((res) =>
        (Array.isArray(res.data?.dailySongs) ? res.data.dailySongs : [])
          .map(parseTrack)
          .filter((item): item is NcmTrackRef => item !== null),
      );
    }
    tasks.newSongs = webRequest<{ result?: unknown[] }>("/api/personalized/newsong", { limit: 20 }, config).then(
      (res) =>
        (Array.isArray(res.result) ? res.result : [])
          .map(parseTrack)
          .filter((item): item is NcmTrackRef => item !== null),
    );
  }

  if (filter === "all" || filter === "playlists") {
    if (hasCookie) {
      tasks.dailyPlaylists = webRequest<{ recommend?: unknown[] }>(
        "/api/v1/discovery/recommend/resource",
        {},
        config,
      ).then((res) =>
        (Array.isArray(res.recommend) ? res.recommend : [])
          .map(parsePlaylist)
          .filter((item): item is NcmPlaylistRef => item !== null),
      );
    }
    tasks.recommendedPlaylists = webRequest<{ result?: unknown[] }>(
      "/api/personalized/playlist",
      { limit: 30 },
      config,
    ).then((res) =>
      (Array.isArray(res.result) ? res.result : [])
        .map(parsePlaylist)
        .filter((item): item is NcmPlaylistRef => item !== null),
    );
  }

  const [dailySongsRes, dailyPlaylistsRes, recommendedPlaylistsRes, newSongsRes] = await Promise.allSettled([
    tasks.dailySongs ?? Promise.resolve([] as NcmTrackRef[]),
    tasks.dailyPlaylists ?? Promise.resolve([] as NcmPlaylistRef[]),
    tasks.recommendedPlaylists ?? Promise.resolve([] as NcmPlaylistRef[]),
    tasks.newSongs ?? Promise.resolve([] as NcmTrackRef[]),
  ]);

  const out: VideoItem[] = [];
  if (dailySongsRes.status === "fulfilled") {
    for (const track of dailySongsRes.value) out.push(toRexSong(track));
  }
  if (dailyPlaylistsRes.status === "fulfilled") {
    for (const pl of dailyPlaylistsRes.value) out.push(toRexPlaylist(pl));
  }
  if (recommendedPlaylistsRes.status === "fulfilled") {
    for (const pl of recommendedPlaylistsRes.value) out.push(toRexPlaylist(pl));
  }
  if (newSongsRes.status === "fulfilled") {
    for (const track of newSongsRes.value) out.push(toRexSong(track));
  }

  if (!out.length) {
    const failed = [dailySongsRes, dailyPlaylistsRes, recommendedPlaylistsRes, newSongsRes].find(
      (res) => res.status === "rejected",
    );
    if (failed?.status === "rejected") {
      throw failed.reason;
    }
  }

  const deduped = dedupeVideoItems(out);
  cacheSongMetaList(deduped);
  return sliceByPage(deduped, params);
}

export async function handleCharts(
  params: CommonGlobalParams & PaginationParams & { category?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "all") as "all" | "official" | "global";

  const response = await webRequest<{ list?: Array<JsonRecord & { ToplistType?: string }> }>(
    "/api/toplist/detail",
    {},
    config,
  );
  const rawList = Array.isArray(response.list) ? response.list : [];
  const filtered = rawList.filter((item) => {
    const isOfficial = typeof item.ToplistType === "string" && item.ToplistType.length > 0;
    if (category === "official") return isOfficial;
    if (category === "global") return !isOfficial;
    return true;
  });

  const playlists = filtered.map(parsePlaylist).filter((item): item is NcmPlaylistRef => item !== null);
  return sliceByPage(dedupeVideoItems(playlists.map(toRexPlaylist)), params);
}

export async function handleNewReleases(
  params: CommonGlobalParams & PaginationParams & { category?: string; area?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "albums") as "albums" | "songs";
  const area = normalizeReleaseArea(params.area);
  const offset = resolveOffset(params);

  if (category === "songs") {
    const areaId = NEW_SONG_AREA_IDS[area];
    const response = await webRequest<{ data?: unknown[] }>(
      "/api/v1/discovery/new/songs",
      { areaId, total: true },
      config,
      { method: "POST" },
    );
    const tracks = (Array.isArray(response.data) ? response.data : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return items.slice(offset, offset + DEFAULT_PAGE_SIZE);
  }

  const response = await webRequest<{ albums?: unknown[] }>(
    "/api/album/new",
    { area, limit: DEFAULT_PAGE_SIZE, offset },
    config,
  );
  const albums = (Array.isArray(response.albums) ? response.albums : [])
    .map(parseAlbum)
    .filter((item): item is NcmAlbumRef => item !== null);
  return dedupeVideoItems(albums.map(toRexAlbum));
}

export async function handleGenres(
  params: CommonGlobalParams & PaginationParams & { genreId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const rawGenreId = stripPrefix((params.genreId || "").trim(), LINK_PREFIX.genre);

  if (!rawGenreId) {
    const items: VideoItem[] = CURATED_GENRES.map((genre) => ({
      id: genre.id,
      type: "url",
      mediaType: "genre",
      link: genreLink(genre.id),
      title: Widget.i18n(genre.title),
      subtitle: Widget.i18n(genre.subtitle),
      genreTitle: Widget.i18n(genre.title),
    }));
    return sliceByPage(items, params);
  }

  const offset = resolveOffset(params);
  const section = params.section || "albums";

  const response = await webRequest<{ playlists?: unknown[] }>(
    "/api/playlist/list",
    { cat: rawGenreId, order: "hot", limit: DEFAULT_PAGE_SIZE, offset, total: true },
    config,
  );
  const playlists = (Array.isArray(response.playlists) ? response.playlists : [])
    .map(parsePlaylist)
    .filter((item): item is NcmPlaylistRef => item !== null);

  if (section === "songs") {
    const seedPlaylist = playlists[0];
    if (!seedPlaylist) {
      return [];
    }
    const { tracks } = await fetchPlaylistTracks(seedPlaylist.id, config, 60);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return items;
  }

  return dedupeVideoItems(playlists.map(toRexPlaylist));
}

async function fetchFmBatch(mode: "DEFAULT" | "FAMILIAR" | "EXPLORE", config: RuntimeConfig): Promise<NcmTrackRef[]> {
  if (!parseCookieAuthInput(config.cookie).hasMusicU) {
    throw new Error(Widget.i18n("私人漫游需要配置网易云音乐 Cookie（含 MUSIC_U）"));
  }
  const response = await eapiRequest<{ data?: unknown[] }>(
    "/api/v1/radio/get",
    { mode, subMode: "", limit: 10 },
    config,
  );
  return (Array.isArray(response.data) ? response.data : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null);
}

async function fetchHeartModeTracks(config: RuntimeConfig): Promise<NcmTrackRef[]> {
  const { uid } = await resolveAccountUid(config);
  const plResponse = await webRequest<{ playlist?: Array<JsonRecord & { specialType?: number }> }>(
    "/api/user/playlist",
    { uid, limit: 30, offset: 0 },
    config,
  );
  const likedPlaylist = (Array.isArray(plResponse.playlist) ? plResponse.playlist : []).find(
    (pl) => Number(pl.specialType) === 5,
  );
  const likedId = likedPlaylist?.id ? String(likedPlaylist.id) : "";
  if (!likedId) {
    throw new Error(Widget.i18n("未找到「我喜欢的音乐」歌单，无法开启心动模式"));
  }

  const { tracks: likedTracks } = await fetchPlaylistTracks(likedId, config, 50);
  const seed = likedTracks[Math.floor(Math.random() * likedTracks.length)];
  if (!seed) {
    throw new Error(Widget.i18n("「我喜欢的音乐」为空，请先收藏几首歌曲再使用心动模式"));
  }

  const response = await eapiRequest<{ data?: Array<{ songInfo?: unknown }> }>(
    "/api/playmode/intelligence/list",
    {
      songId: seed.id,
      startMusicId: seed.id,
      playlistId: likedId,
      type: "fromPlayOne",
      count: 30,
    },
    config,
  );
  const songs = (Array.isArray(response.data) ? response.data : [])
    .map((entry) => parseTrack(entry?.songInfo))
    .filter((item): item is NcmTrackRef => item !== null);
  return songs.length ? songs : likedTracks;
}

export async function handleRadios(
  params: CommonGlobalParams & PaginationParams & { radioId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const rawRadioId = stripPrefix((params.radioId || "").trim(), LINK_PREFIX.radio);

  if (!rawRadioId) {
    const stations: VideoItem[] = [
      {
        id: "fm:DEFAULT",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:DEFAULT"),
        title: Widget.i18n("私人漫游 · 默认"),
        subtitle: Widget.i18n("根据你的听歌口味持续推荐（需配置 Cookie）"),
      },
      {
        id: "fm:FAMILIAR",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:FAMILIAR"),
        title: Widget.i18n("私人漫游 · 熟悉"),
        subtitle: Widget.i18n("重温你熟悉和喜欢的旋律（需配置 Cookie）"),
      },
      {
        id: "fm:EXPLORE",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:EXPLORE"),
        title: Widget.i18n("私人漫游 · 探索"),
        subtitle: Widget.i18n("发现新鲜小众好音乐（需配置 Cookie）"),
      },
      {
        id: "heart",
        type: "url",
        mediaType: "radio",
        link: radioLink("heart"),
        title: Widget.i18n("心动模式"),
        subtitle: Widget.i18n("以我喜欢的音乐为种子智能推荐（需配置 Cookie）"),
      },
      {
        id: "radar",
        type: "url",
        mediaType: "radio",
        link: radioLink("radar"),
        title: Widget.i18n("私人雷达"),
        subtitle: Widget.i18n("每日更新的个性化精选电台"),
      },
    ];

    try {
      const charts = await webRequest<{ list?: unknown[] }>("/api/toplist/detail", {}, config);
      const topLists = (Array.isArray(charts.list) ? charts.list : [])
        .map(parsePlaylist)
        .filter((item): item is NcmPlaylistRef => item !== null)
        .slice(0, 8);
      for (const pl of topLists) {
        stations.push({
          id: `pl:${pl.id}`,
          type: "url",
          mediaType: "radio",
          link: radioLink(`pl:${pl.id}`),
          title: pl.name,
          ...(pl.owner ? { subtitle: pl.owner } : {}),
          ...(pl.imageUrl ? { posterPath: pl.imageUrl, coverUrl: pl.imageUrl } : {}),
        });
      }
    } catch {
      // Keep built-in stations even if charts request fails
    }

    return sliceByPage(stations, params);
  }

  let tracks: NcmTrackRef[] = [];
  if (rawRadioId === "fm:DEFAULT" || rawRadioId === "fm:FAMILIAR" || rawRadioId === "fm:EXPLORE") {
    const mode = rawRadioId.slice(3) as "DEFAULT" | "FAMILIAR" | "EXPLORE";
    // Fetch two batches for a richer Rex playback queue
    const [first, second] = await Promise.allSettled([fetchFmBatch(mode, config), fetchFmBatch(mode, config)]);
    if (first.status === "fulfilled") tracks.push(...first.value);
    if (second.status === "fulfilled") tracks.push(...second.value);
    if (!tracks.length && first.status === "rejected") {
      throw first.reason;
    }
  } else if (rawRadioId === "heart") {
    tracks = await fetchHeartModeTracks(config);
  } else if (rawRadioId === "radar") {
    tracks = (await fetchPlaylistTracks(PRIVATE_RADAR_PLAYLIST_ID, config, 60)).tracks;
  } else if (rawRadioId.startsWith("pl:") && isValidNumericId(rawRadioId.slice(3))) {
    tracks = (await fetchPlaylistTracks(rawRadioId.slice(3), config, 60)).tracks;
  } else if (isValidNumericId(rawRadioId)) {
    tracks = (await fetchPlaylistTracks(rawRadioId, config, 60)).tracks;
  }

  const section = params.section || "songs";
  if (section === "artists") {
    const artists = dedupeVideoItems(
      tracks
        .flatMap((t) => t.artists)
        .filter((a) => a.id)
        .map((a) => toRexArtist(a)),
    );
    return sliceByPage(artists, params);
  }
  if (section === "albums") {
    const albums = dedupeVideoItems(
      tracks.flatMap((t) =>
        t.album?.id
          ? [
              toRexAlbum({
                id: t.album.id,
                name: t.album.name,
                imageUrl: t.album.imageUrl || t.imageUrl,
                artists: t.artists,
              }),
            ]
          : [],
      ),
    );
    return sliceByPage(albums, params);
  }

  const items = dedupeVideoItems(tracks.map(toRexSong));
  cacheSongMetaList(items);
  return sliceByPage(items, params);
}

export async function handleArtists(
  params: CommonGlobalParams & PaginationParams & { peopleId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const peopleId = (params.peopleId || "").trim();
  const offset = resolveOffset(params);

  if (!peopleId) {
    const response = await webRequest<{ artists?: unknown[] }>(
      "/api/artist/top",
      { limit: DEFAULT_PAGE_SIZE, offset },
      config,
    );
    const artists = (Array.isArray(response.artists) ? response.artists : [])
      .map(parseArtist)
      .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
    return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
  }

  if (!isValidNumericId(peopleId)) {
    return [];
  }

  if (params.section === "profile") {
    const response = await webRequest<{ artist?: JsonRecord }>(`/api/v1/artist/${peopleId}`, {}, config);
    const artist = parseArtist(response.artist);
    if (!artist) {
      return [];
    }
    const rawArtist = response.artist || {};
    const briefDesc = typeof rawArtist.briefDesc === "string" ? rawArtist.briefDesc.trim() : "";
    const musicSize = Number(rawArtist.musicSize) || 0;
    const albumSize = Number(rawArtist.albumSize) || 0;
    const stats = [
      musicSize > 0 ? `${musicSize} ${Widget.i18n("首歌曲")}` : "",
      albumSize > 0 ? `${albumSize} ${Widget.i18n("张专辑")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const description = [stats, briefDesc].filter(Boolean).join("\n") || undefined;
    return [toRexArtist(artist, description)];
  }

  if (params.section === "albums") {
    const response = await webRequest<{ hotAlbums?: unknown[] }>(
      `/api/artist/albums/${peopleId}`,
      { limit: DEFAULT_PAGE_SIZE, offset },
      config,
    );
    const albums = (Array.isArray(response.hotAlbums) ? response.hotAlbums : [])
      .map(parseAlbum)
      .filter((item): item is NcmAlbumRef => item !== null);
    return dedupeVideoItems(albums.map(toRexAlbum));
  }

  if (params.section === "artists") {
    try {
      const response = await webRequest<{ artists?: unknown[] }>(
        "/api/discovery/simiArtist",
        { artistid: peopleId },
        config,
        { method: "POST" },
      );
      const artists = (Array.isArray(response.artists) ? response.artists : [])
        .map(parseArtist)
        .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id) && item.id !== peopleId);
      return sliceByPage(dedupeVideoItems(artists.map((a) => toRexArtist(a))), params);
    } catch {
      return [];
    }
  }

  // section === "songs" or omitted
  if (offset === 0) {
    const response = await webRequest<{ hotSongs?: unknown[] }>(`/api/v1/artist/${peopleId}`, {}, config);
    const tracks = (Array.isArray(response.hotSongs) ? response.hotSongs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    if (tracks.length) {
      const items = dedupeVideoItems(tracks.map(toRexSong));
      cacheSongMetaList(items);
      return items.slice(0, DEFAULT_PAGE_SIZE);
    }
  }

  const response = await webRequest<{ songs?: unknown[] }>(
    "/api/v1/artist/songs",
    { id: peopleId, order: "hot", limit: DEFAULT_PAGE_SIZE, offset },
    config,
    { method: "POST" },
  );
  const tracks = (Array.isArray(response.songs) ? response.songs : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null);
  const items = dedupeVideoItems(tracks.map(toRexSong));
  cacheSongMetaList(items);
  return items;
}

export async function handleLibrary(
  params: CommonGlobalParams & PaginationParams & { tab?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const tab = (params.tab || "liked") as "liked" | "playlists" | "cloud" | "recent_week" | "recent_all";
  const offset = resolveOffset(params);

  const { uid } = await resolveAccountUid(config);

  if (tab === "cloud") {
    const response = await eapiRequest<{
      data?: Array<{
        songId?: number | string;
        songName?: string;
        artist?: string;
        album?: string;
        simpleSong?: JsonRecord;
      }>;
    }>("/api/v1/cloud/get", { limit: DEFAULT_PAGE_SIZE, offset }, config);

    const tracks: NcmTrackRef[] = [];
    for (const item of Array.isArray(response.data) ? response.data : []) {
      const parsed = parseTrack(item.simpleSong);
      if (parsed) {
        tracks.push(parsed);
        continue;
      }
      const id = item.songId ? String(item.songId) : "";
      if (isValidNumericId(id)) {
        tracks.push({
          id,
          name: item.songName || id,
          artists: item.artist ? [{ id: "", name: item.artist }] : [],
          album: item.album ? { id: "", name: item.album } : undefined,
          duration: 0,
        });
      }
    }
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return items;
  }

  if (tab === "recent_week" || tab === "recent_all") {
    const recordType = tab === "recent_week" ? 1 : 0;
    const response = await webRequest<{
      weekData?: Array<{ song?: unknown }>;
      allData?: Array<{ song?: unknown }>;
    }>("/api/v1/play/record", { uid, type: recordType }, config, { method: "POST" });
    const rows = recordType === 1 ? response.weekData : response.allData;
    const tracks = (Array.isArray(rows) ? rows : [])
      .map((entry) => parseTrack(entry?.song))
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }

  const plResponse = await webRequest<{ playlist?: Array<JsonRecord & { specialType?: number }> }>(
    "/api/user/playlist",
    { uid, limit: tab === "playlists" ? DEFAULT_PAGE_SIZE : 30, offset: tab === "playlists" ? offset : 0 },
    config,
  );
  const rawPlaylists = Array.isArray(plResponse.playlist) ? plResponse.playlist : [];

  if (tab === "playlists") {
    const playlists = rawPlaylists.map(parsePlaylist).filter((item): item is NcmPlaylistRef => item !== null);
    return dedupeVideoItems(playlists.map(toRexPlaylist));
  }

  // tab === "liked"
  const liked = rawPlaylists.find((pl) => Number(pl.specialType) === 5) ?? rawPlaylists[0];
  const likedId = liked?.id ? String(liked.id) : "";
  if (!likedId) {
    return [];
  }
  const { tracks } = await fetchPlaylistTracks(likedId, config, MAX_PLAYLIST_TRACKS);
  const items = dedupeVideoItems(tracks.map(toRexSong));
  cacheSongMetaList(items);
  return sliceByPage(items, params);
}

export async function handleSearch(
  params: CommonGlobalParams & PaginationParams & { keyword?: string; kind?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const keyword = (params.keyword || "").trim();
  if (!keyword) {
    return [];
  }

  const kind = (params.kind || "all") as SearchKind;
  const page = parsePage(params.page);
  const offset = resolveOffset(params);

  if (kind === "all") {
    if (page === 1 && offset === 0) {
      const [songsRes, artistsRes, albumsRes, playlistsRes] = await Promise.allSettled([
        webRequest<{ result?: { songs?: unknown[] } }>(
          "/api/cloudsearch/pc",
          { s: keyword, type: SEARCH_TYPE_CODES.songs, limit: 20, offset: 0, total: true },
          config,
          { method: "POST" },
        ),
        webRequest<{ result?: { artists?: unknown[] } }>(
          "/api/cloudsearch/pc",
          { s: keyword, type: SEARCH_TYPE_CODES.artists, limit: 4, offset: 0, total: true },
          config,
          { method: "POST" },
        ),
        webRequest<{ result?: { albums?: unknown[] } }>(
          "/api/cloudsearch/pc",
          { s: keyword, type: SEARCH_TYPE_CODES.albums, limit: 4, offset: 0, total: true },
          config,
          { method: "POST" },
        ),
        webRequest<{ result?: { playlists?: unknown[] } }>(
          "/api/cloudsearch/pc",
          { s: keyword, type: SEARCH_TYPE_CODES.playlists, limit: 4, offset: 0, total: true },
          config,
          { method: "POST" },
        ),
      ]);

      const out: VideoItem[] = [];
      if (artistsRes.status === "fulfilled") {
        const artists = (Array.isArray(artistsRes.value.result?.artists) ? artistsRes.value.result.artists : [])
          .map(parseArtist)
          .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
        for (const artist of artists) out.push(toRexArtist(artist));
      }
      if (albumsRes.status === "fulfilled") {
        const albums = (Array.isArray(albumsRes.value.result?.albums) ? albumsRes.value.result.albums : [])
          .map(parseAlbum)
          .filter((item): item is NcmAlbumRef => item !== null);
        for (const album of albums) out.push(toRexAlbum(album));
      }
      if (songsRes.status === "fulfilled") {
        const songs = (Array.isArray(songsRes.value.result?.songs) ? songsRes.value.result.songs : [])
          .map(parseTrack)
          .filter((item): item is NcmTrackRef => item !== null);
        for (const song of songs) out.push(toRexSong(song));
      }
      if (playlistsRes.status === "fulfilled") {
        const playlists = (
          Array.isArray(playlistsRes.value.result?.playlists) ? playlistsRes.value.result.playlists : []
        )
          .map(parsePlaylist)
          .filter((item): item is NcmPlaylistRef => item !== null);
        for (const pl of playlists) out.push(toRexPlaylist(pl));
      }

      if (!out.length && songsRes.status === "rejected") {
        throw songsRes.reason;
      }

      const deduped = dedupeVideoItems(out);
      cacheSongMetaList(deduped);
      return deduped;
    }

    // Page 2+ in "all" mode continues song results
    const songOffset = Math.max(20, (page - 1) * 20);
    const response = await webRequest<{ result?: { songs?: unknown[] } }>(
      "/api/cloudsearch/pc",
      { s: keyword, type: SEARCH_TYPE_CODES.songs, limit: 20, offset: songOffset, total: true },
      config,
      { method: "POST" },
    );
    const songs = (Array.isArray(response.result?.songs) ? response.result.songs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(songs.map(toRexSong));
    cacheSongMetaList(items);
    return items;
  }

  const typeCode = SEARCH_TYPE_CODES[kind];
  const response = await webRequest<{
    result?: {
      songs?: unknown[];
      albums?: unknown[];
      artists?: unknown[];
      playlists?: unknown[];
    };
  }>("/api/cloudsearch/pc", { s: keyword, type: typeCode, limit: DEFAULT_PAGE_SIZE, offset, total: true }, config, {
    method: "POST",
  });

  if (kind === "songs") {
    const songs = (Array.isArray(response.result?.songs) ? response.result.songs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(songs.map(toRexSong));
    cacheSongMetaList(items);
    return items;
  }
  if (kind === "albums") {
    const albums = (Array.isArray(response.result?.albums) ? response.result.albums : [])
      .map(parseAlbum)
      .filter((item): item is NcmAlbumRef => item !== null);
    return dedupeVideoItems(albums.map(toRexAlbum));
  }
  if (kind === "artists") {
    const artists = (Array.isArray(response.result?.artists) ? response.result.artists : [])
      .map(parseArtist)
      .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
    return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
  }
  const playlists = (Array.isArray(response.result?.playlists) ? response.result.playlists : [])
    .map(parsePlaylist)
    .filter((item): item is NcmPlaylistRef => item !== null);
  return dedupeVideoItems(playlists.map(toRexPlaylist));
}

async function loadSongDetail(songId: string, config: RuntimeConfig): Promise<VideoItem> {
  let cachedMeta = getCachedSongMeta(songId);
  const [stream, fetchedMeta] = await Promise.all([
    resolveAudioStream(songId, config),
    cachedMeta
      ? Promise.resolve(null)
      : fetchSongDetails([songId], config)
          .then((list) => list[0] ?? null)
          .catch(() => null),
  ]);

  if (!cachedMeta && fetchedMeta) {
    const rexItem = toRexSong(fetchedMeta);
    cacheSongMetaList([rexItem]);
    cachedMeta = {
      id: songId,
      title: rexItem.title,
      subtitle: rexItem.subtitle,
      posterPath: rexItem.posterPath,
      coverUrl: rexItem.coverUrl,
      duration: rexItem.duration,
      durationText: rexItem.durationText,
      peoples: rexItem.peoples,
    };
  }

  const duration = cachedMeta?.duration || 0;
  const durationText = duration > 0 ? formatDuration(duration) : cachedMeta?.durationText;
  const cover = cachedMeta?.posterPath || cachedMeta?.coverUrl;
  const playerType = resolvePlayerType(config.playerType, stream.format);
  const subtitleParts = [cachedMeta?.subtitle || "", stream.isTrial ? Widget.i18n("试听") : ""].filter(Boolean);

  return {
    id: songId,
    type: "url",
    mediaType: "song",
    link: songLink(songId),
    title: cachedMeta?.title || songId,
    ...(subtitleParts.length ? { subtitle: subtitleParts.join(" · ") } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(duration > 0 ? { duration, ...(durationText ? { durationText } : {}) } : {}),
    ...(cachedMeta?.peoples?.length ? { peoples: cachedMeta.peoples } : {}),
    videoUrl: stream.url,
    customHeaders: stream.headers,
    ...(playerType ? { playerType } : {}),
  };
}

async function loadAlbumDetail(albumId: string, config: RuntimeConfig): Promise<VideoItem> {
  const response = await webRequest<{ album?: JsonRecord; songs?: unknown[] }>(`/api/v1/album/${albumId}`, {}, config);
  const album = parseAlbum(response.album);
  if (!album) {
    throw new Error(Widget.i18n("未找到该专辑"));
  }

  const rawSongs = (Array.isArray(response.songs) ? response.songs : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null)
    .map((track) => ({
      ...track,
      artists: track.artists.length ? track.artists : album.artists,
      album: { id: album.id, name: album.name, imageUrl: album.imageUrl },
      imageUrl: track.imageUrl || album.imageUrl,
    }));

  const rexTracks = rawSongs.map(toRexSong);
  cacheSongMetaList(rexTracks);

  const artistNames = album.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join(" / ");
  const peoples = toRexPeoples(album.artists);
  const cover = formatCoverUrl(album.imageUrl);

  return {
    id: album.id,
    type: "url",
    mediaType: "album",
    link: `ncm:album:${album.id}`,
    title: album.name,
    ...(artistNames ? { subtitle: artistNames } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(album.released ? { releaseDate: album.released } : {}),
    ...(album.description ? { description: album.description } : {}),
    ...(peoples ? { peoples } : {}),
    tracks: rexTracks,
  };
}

async function loadPlaylistDetail(playlistId: string, config: RuntimeConfig): Promise<VideoItem> {
  const { playlist, tracks } = await fetchPlaylistTracks(playlistId, config, MAX_PLAYLIST_TRACKS);
  const rexTracks = tracks.map(toRexSong);
  cacheSongMetaList(rexTracks);

  return {
    id: playlist.id,
    type: "url",
    mediaType: "playlist",
    link: playlistLink(playlist.id),
    title: playlist.name,
    ...(playlist.owner ? { subtitle: playlist.owner } : {}),
    ...(playlist.imageUrl ? { posterPath: playlist.imageUrl, coverUrl: playlist.imageUrl } : {}),
    ...(playlist.description ? { description: playlist.description } : {}),
    tracks: rexTracks,
  };
}

export async function handleDetail(link: string): Promise<VideoItem> {
  const parsed = parseDetailLink(link);
  if (!parsed) {
    throw new Error(`${Widget.i18n("无法识别的详情链接")}: ${link}`);
  }
  const config = getRuntimeConfig();

  if (parsed.kind === "song") {
    return loadSongDetail(parsed.id, config);
  }
  if (parsed.kind === "album") {
    return loadAlbumDetail(parsed.id, config);
  }
  return loadPlaylistDetail(parsed.id, config);
}
