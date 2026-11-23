import { parseCookieAuthInput } from "./auth";
import {
  eapiRequest,
  fetchArtistAvatarsBatch,
  fetchLikedSongIds,
  fetchMvUrl,
  fetchSongDetails,
  fetchSongDynamicCover,
  fetchSongLyric,
  fetchSubscribedAlbumIds,
  fetchSubscribedArtistIds,
  fetchSubscribedPodcastIds,
  fetchUserPlaylistOwnership,
  resolveAccountUid,
  resolveAudioStream,
  scrobbleSong,
  toggleAlbumSubscribe,
  toggleArtistSubscribe,
  togglePlaylistSubscribe,
  togglePodcastSubscribe,
  toggleSongLike,
  webRequest,
} from "./client";
import {
  ARTIST_AREA_CODES,
  ARTIST_TYPE_CODES,
  type ArtistArea,
  type ArtistType,
  type BannerClientType,
  CHART_ARTIST_AREA_CODES,
  CURATED_GENRES,
  DEFAULT_PAGE_SIZE,
  djLink,
  FAVORITE_ACTION_FN,
  formatCoverUrl,
  genreLink,
  hotSearchLink,
  ITEM_ACTION_IDS,
  isValidNumericId,
  LINK_PREFIX,
  MAX_PLAYLIST_TRACKS,
  MAX_PODCAST_PROGRAMS,
  NEW_SONG_AREA_IDS,
  normalizeHttpsUrl,
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
import { buildLyricSubtitleItems } from "./lyrics";
import {
  dedupeVideoItems,
  formatDuration,
  type JsonRecord,
  type NcmAlbumRef,
  type NcmArtistRef,
  type NcmDjProgramRef,
  type NcmDjRadioRef,
  type NcmPlaylistRef,
  type NcmStyleTagRef,
  type NcmTrackRef,
  parseAlbum,
  parseArtist,
  parseDjProgram,
  parseDjRadio,
  parsePlaylist,
  parseStyleTag,
  parseTrack,
  toRexAlbum,
  toRexArtist,
  toRexDjProgram,
  toRexDjRadio,
  toRexGenreItems,
  toRexPeoples,
  toRexPlaylist,
  toRexSong,
} from "./parser";
import {
  cacheArtistAvatars,
  cacheSongMetaList,
  getCachedFavoriteIds,
  getCachedGenreCovers,
  getCachedSongMeta,
  getRuntimeConfig,
  mergeCachedFavoriteIds,
  type RuntimeConfig,
  setCachedFavoriteIds,
  setCachedGenreCovers,
  syncRuntimeConfig,
  type TrackCacheHint,
  updateCachedFavoriteId,
} from "./storage";

interface CommonGlobalParams {
  cookie?: string;
  quality?: string;
  allowTrial?: string;
  playerType?: string;
  reportHistory?: string;
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

function normalizeArtistArea(value?: string): ArtistArea {
  if (value === "ZH" || value === "EA" || value === "JP" || value === "KR" || value === "OTHER") {
    return value;
  }
  return "ALL";
}

function normalizeArtistType(value?: string): ArtistType {
  if (value === "MALE" || value === "FEMALE" || value === "BAND") {
    return value;
  }
  return "ALL";
}

function buildTrackHints(tracks: readonly NcmTrackRef[]): TrackCacheHint[] {
  return tracks.map((track) => ({
    id: track.id,
    ...(track.mvId ? { mvId: track.mvId } : {}),
    ...(track.album?.id ? { albumId: track.album.id } : {}),
  }));
}

function cacheTracks(tracks: readonly NcmTrackRef[], items: VideoItem[]): void {
  cacheSongMetaList(items, buildTrackHints(tracks));
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

async function fetchDjRadioWithPrograms(
  radioId: string,
  config: RuntimeConfig,
  limit = MAX_PODCAST_PROGRAMS,
): Promise<{ radio: NcmDjRadioRef; programs: NcmDjProgramRef[] }> {
  const [detailRes, programsRes] = await Promise.allSettled([
    eapiRequest<{ data?: JsonRecord }>("/api/djradio/v2/get", { id: radioId }, config),
    eapiRequest<{ programs?: unknown[] }>("/api/dj/program/byradio", { radioId, limit, offset: 0, asc: false }, config),
  ]);

  const rawRadio = detailRes.status === "fulfilled" ? detailRes.value.data : undefined;
  const radio = parseDjRadio(rawRadio) ?? {
    id: radioId,
    name: radioId,
  };

  const rawPrograms =
    programsRes.status === "fulfilled" && Array.isArray(programsRes.value.programs) ? programsRes.value.programs : [];
  const programs = rawPrograms
    .map(parseDjProgram)
    .filter((item): item is NcmDjProgramRef => item !== null)
    .map((program) => ({
      ...program,
      host: program.host || radio.host,
      radioName: program.radioName || radio.name,
      imageUrl: program.imageUrl || radio.imageUrl,
    }));

  if (!programs.length && detailRes.status === "rejected" && programsRes.status === "rejected") {
    throw detailRes.reason;
  }

  return { radio, programs };
}

async function loadHomeList(params: CommonGlobalParams & PaginationParams & { filter?: string }): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const filter = (params.filter || "all") as "all" | "daily" | "history_daily" | "highquality" | "songs" | "playlists";
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
    cacheTracks(tracks, items);
    return sliceByPage(items, params);
  }

  if (filter === "history_daily") {
    if (!hasCookie) {
      throw new Error(Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后查看个人内容"));
    }
    const datesRes = await eapiRequest<{ data?: { dates?: string[] } }>(
      "/api/discovery/recommend/songs/history/recent",
      {},
      config,
    );
    const dates = Array.isArray(datesRes.data?.dates) ? datesRes.data.dates.filter(Boolean) : [];
    const latestDate = dates[0];
    if (!latestDate) {
      return [];
    }
    const detailRes = await eapiRequest<{ data?: { songs?: unknown[] } }>(
      "/api/discovery/recommend/songs/history/detail",
      { date: latestDate },
      config,
    );
    const tracks = (Array.isArray(detailRes.data?.songs) ? detailRes.data.songs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheTracks(tracks, items);
    return sliceByPage(items, params);
  }

  if (filter === "highquality") {
    const response = await eapiRequest<{ playlists?: unknown[] }>(
      "/api/playlist/highquality/list",
      { cat: "全部", limit: 60, lasttime: 0, total: true },
      config,
    );
    const playlists = (Array.isArray(response.playlists) ? response.playlists : [])
      .map(parsePlaylist)
      .filter((item): item is NcmPlaylistRef => item !== null);
    return sliceByPage(dedupeVideoItems(playlists.map(toRexPlaylist)), params);
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
  const allTracks: NcmTrackRef[] = [];
  if (dailySongsRes.status === "fulfilled") {
    for (const track of dailySongsRes.value) {
      allTracks.push(track);
      out.push(toRexSong(track));
    }
  }
  if (dailyPlaylistsRes.status === "fulfilled") {
    for (const pl of dailyPlaylistsRes.value) out.push(toRexPlaylist(pl));
  }
  if (recommendedPlaylistsRes.status === "fulfilled") {
    for (const pl of recommendedPlaylistsRes.value) out.push(toRexPlaylist(pl));
  }
  if (newSongsRes.status === "fulfilled") {
    for (const track of newSongsRes.value) {
      allTracks.push(track);
      out.push(toRexSong(track));
    }
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
  cacheTracks(allTracks, deduped);
  return sliceByPage(deduped, params);
}

interface RawBannerItem {
  targetId?: number | string;
  targetType?: number | string;
  typeTitle?: string;
  pic?: string;
  imageUrl?: string;
  song?: unknown;
}

function normalizeBannerClientType(value?: string): BannerClientType {
  if (value === "pc" || value === "iphone" || value === "android" || value === "ipad") {
    return value;
  }
  return "ipad";
}

function attachBannerMedia(item: VideoItem, bannerImage: string | undefined, typeTitle: string): VideoItem {
  const subtitleParts = [typeTitle, item.subtitle || ""].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || undefined;
  return {
    ...item,
    ...(subtitle ? { subtitle } : {}),
    ...(bannerImage ? { backdropPath: bannerImage } : {}),
    ...(!item.posterPath && bannerImage ? { posterPath: bannerImage } : {}),
    ...(bannerImage ? { coverUrl: bannerImage } : {}),
  };
}

async function loadBannersList(
  params: CommonGlobalParams & PaginationParams & { clientType?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const clientType = normalizeBannerClientType(params.clientType);

  const response = await eapiRequest<{ banners?: RawBannerItem[] }>("/api/v2/banner/get", { clientType }, config);
  const rawBanners = Array.isArray(response.banners) ? response.banners : [];

  const playable = rawBanners
    .map((entry) => {
      const targetId = entry?.targetId !== undefined ? String(entry.targetId).trim() : "";
      const targetType = Number(entry?.targetType) || 0;
      const bannerImage = normalizeHttpsUrl(
        typeof entry?.pic === "string" ? entry.pic : typeof entry?.imageUrl === "string" ? entry.imageUrl : undefined,
      );
      const typeTitle = typeof entry?.typeTitle === "string" ? entry.typeTitle.trim() : "";
      const embeddedSong = targetType === 1 ? parseTrack(entry?.song) : null;
      return { targetId, targetType, bannerImage, typeTitle, embeddedSong };
    })
    .filter(
      (entry) =>
        isValidNumericId(entry.targetId) &&
        entry.targetId !== "0" &&
        (entry.targetType === 1 || entry.targetType === 10 || entry.targetType === 1000 || entry.targetType === 1009),
    );

  if (!playable.length) {
    return [];
  }

  const missingSongIds = playable
    .filter((entry) => entry.targetType === 1 && !entry.embeddedSong)
    .map((entry) => entry.targetId);
  const albumIds = Array.from(
    new Set(playable.filter((entry) => entry.targetType === 10).map((entry) => entry.targetId)),
  );
  const playlistIds = Array.from(
    new Set(playable.filter((entry) => entry.targetType === 1000).map((entry) => entry.targetId)),
  );
  const djIds = Array.from(
    new Set(playable.filter((entry) => entry.targetType === 1009).map((entry) => entry.targetId)),
  );

  const [fetchedSongsRes, albumResults, playlistResults, djResults] = await Promise.all([
    missingSongIds.length
      ? fetchSongDetails(missingSongIds, config).catch(() => [] as NcmTrackRef[])
      : Promise.resolve([] as NcmTrackRef[]),
    Promise.allSettled(
      albumIds.map((id) => webRequest<{ album?: JsonRecord }>(`/api/v1/album/${id}`, {}, config, { timeout: 8 })),
    ),
    Promise.allSettled(
      playlistIds.map((id) =>
        webRequest<{ playlist?: JsonRecord }>("/api/v6/playlist/detail", { id, n: 0, s: 0 }, config, {
          method: "POST",
          timeout: 8,
        }),
      ),
    ),
    Promise.allSettled(
      djIds.map((id) => eapiRequest<{ data?: JsonRecord }>("/api/djradio/v2/get", { id }, config, { timeout: 8 })),
    ),
  ]);

  const songMap = new Map<string, NcmTrackRef>();
  for (const track of fetchedSongsRes) {
    songMap.set(track.id, track);
  }
  const albumMap = new Map<string, NcmAlbumRef>();
  for (let i = 0; i < albumIds.length; i++) {
    const res = albumResults[i];
    if (res.status === "fulfilled") {
      const parsed = parseAlbum(res.value.album);
      if (parsed) albumMap.set(albumIds[i], parsed);
    }
  }
  const playlistMap = new Map<string, NcmPlaylistRef>();
  for (let i = 0; i < playlistIds.length; i++) {
    const res = playlistResults[i];
    if (res.status === "fulfilled") {
      const parsed = parsePlaylist(res.value.playlist);
      if (parsed) playlistMap.set(playlistIds[i], parsed);
    }
  }
  const djMap = new Map<string, NcmDjRadioRef>();
  for (let i = 0; i < djIds.length; i++) {
    const res = djResults[i];
    if (res.status === "fulfilled") {
      const parsed = parseDjRadio(res.value.data);
      if (parsed) djMap.set(djIds[i], parsed);
    }
  }

  const out: VideoItem[] = [];
  const allTracks: NcmTrackRef[] = [];

  for (const entry of playable) {
    if (entry.targetType === 1) {
      const track = entry.embeddedSong ?? songMap.get(entry.targetId);
      if (track) {
        allTracks.push(track);
        out.push(attachBannerMedia(toRexSong(track), entry.bannerImage, entry.typeTitle));
      } else {
        out.push(
          attachBannerMedia(
            {
              id: entry.targetId,
              type: "url",
              mediaType: "song",
              link: songLink(entry.targetId),
              title: entry.typeTitle || entry.targetId,
            },
            entry.bannerImage,
            "",
          ),
        );
      }
      continue;
    }

    if (entry.targetType === 10) {
      const album = albumMap.get(entry.targetId);
      const baseItem: VideoItem = album
        ? toRexAlbum(album)
        : {
            id: entry.targetId,
            type: "url",
            mediaType: "album",
            link: `ncm:album:${entry.targetId}`,
            title: entry.typeTitle || entry.targetId,
          };
      out.push(attachBannerMedia(baseItem, entry.bannerImage, album ? entry.typeTitle : ""));
      continue;
    }

    if (entry.targetType === 1000) {
      const playlist = playlistMap.get(entry.targetId);
      const baseItem: VideoItem = playlist
        ? toRexPlaylist(playlist)
        : {
            id: entry.targetId,
            type: "url",
            mediaType: "playlist",
            link: playlistLink(entry.targetId),
            title: entry.typeTitle || entry.targetId,
          };
      out.push(attachBannerMedia(baseItem, entry.bannerImage, playlist ? entry.typeTitle : ""));
      continue;
    }

    if (entry.targetType === 1009) {
      const radio = djMap.get(entry.targetId);
      const baseItem: VideoItem = radio
        ? toRexDjRadio(radio)
        : {
            id: `dj:${entry.targetId}`,
            type: "url",
            mediaType: "playlist",
            link: djLink(entry.targetId),
            title: entry.typeTitle || entry.targetId,
          };
      out.push(attachBannerMedia(baseItem, entry.bannerImage, radio ? entry.typeTitle : ""));
    }
  }

  const deduped = dedupeVideoItems(out);
  cacheTracks(allTracks, deduped);
  return sliceByPage(deduped, params);
}

async function loadChartsList(
  params: CommonGlobalParams & PaginationParams & { category?: string; artistArea?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "all") as "all" | "official" | "global" | "artists";

  if (category === "artists") {
    const areaKey =
      params.artistArea === "EA" || params.artistArea === "KR" || params.artistArea === "JP" ? params.artistArea : "ZH";
    const type = CHART_ARTIST_AREA_CODES[areaKey];
    const response = await eapiRequest<{ list?: { artists?: unknown[] } }>(
      "/api/toplist/artist",
      { type, limit: 100, offset: 0, total: true },
      config,
    );
    const artists = (Array.isArray(response.list?.artists) ? response.list.artists : [])
      .map(parseArtist)
      .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
    return sliceByPage(dedupeVideoItems(artists.map((a) => toRexArtist(a))), params);
  }

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

async function loadNewReleasesList(
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
    cacheTracks(tracks, items);
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

async function fetchCuratedGenreCovers(config: RuntimeConfig): Promise<Record<string, string>> {
  const cached = getCachedGenreCovers();
  const missingGenres = CURATED_GENRES.filter((genre) => !cached[genre.id]);
  if (!missingGenres.length) {
    return cached;
  }

  const covers: Record<string, string> = { ...cached };
  const newlyFetched: Record<string, string> = {};

  // 1. Fetch Style Hall artwork in a single request for all style-mapped genres
  const styleMappedMissing = missingGenres.filter((genre) => Boolean(genre.styleTagId));
  if (styleMappedMissing.length) {
    try {
      const styleRes = await eapiRequest<{ data?: unknown[] }>("/api/tag/list/get", {}, config, { timeout: 6 });
      const styleMap = new Map<string, string>();
      for (const raw of Array.isArray(styleRes.data) ? styleRes.data : []) {
        const parsed = parseStyleTag(raw);
        if (parsed?.tagId && parsed.imageUrl) {
          styleMap.set(parsed.tagId, parsed.imageUrl);
        }
      }
      for (const genre of styleMappedMissing) {
        const pic = genre.styleTagId ? styleMap.get(genre.styleTagId) : undefined;
        if (pic) {
          covers[genre.id] = pic;
          newlyFetched[genre.id] = pic;
        }
      }
    } catch {
      // Fall back to playlist cover lookup below
    }
  }

  // 2. Fetch top hot playlist cover for remaining categories (language / mood / scene / theme)
  const stillMissing = CURATED_GENRES.filter((genre) => !covers[genre.id]);
  if (stillMissing.length) {
    const results = await Promise.allSettled(
      stillMissing.map((genre) =>
        eapiRequest<{ playlists?: Array<{ coverImgUrl?: string; picUrl?: string }> }>(
          "/api/playlist/list",
          { cat: genre.id, order: "hot", limit: 1, offset: 0 },
          config,
          { timeout: 6 },
        ),
      ),
    );
    for (let i = 0; i < stillMissing.length; i++) {
      const res = results[i];
      if (res.status !== "fulfilled") {
        continue;
      }
      const first = Array.isArray(res.value.playlists) ? res.value.playlists[0] : undefined;
      const pic = formatCoverUrl(first?.coverImgUrl || first?.picUrl);
      if (pic) {
        const genreId = stillMissing[i].id;
        covers[genreId] = pic;
        newlyFetched[genreId] = pic;
      }
    }
  }

  if (Object.keys(newlyFetched).length) {
    setCachedGenreCovers(newlyFetched);
  }
  return covers;
}

async function hydrateArtistsFromTracks(tracks: readonly NcmTrackRef[], config: RuntimeConfig): Promise<VideoItem[]> {
  const uniqueArtists: NcmArtistRef[] = [];
  const seen = new Set<string>();
  const fallbackCoverByArtist = new Map<string, string>();

  for (const track of tracks) {
    const trackCover = track.imageUrl || track.album?.imageUrl;
    for (const artist of track.artists) {
      if (!artist.id || seen.has(artist.id)) {
        continue;
      }
      seen.add(artist.id);
      uniqueArtists.push(artist);
      if (trackCover && !fallbackCoverByArtist.has(artist.id)) {
        fallbackCoverByArtist.set(artist.id, trackCover);
      }
    }
  }

  const missingAvatarIds = uniqueArtists.filter((a) => !a.imageUrl).map((a) => a.id);
  const fetchedAvatars = missingAvatarIds.length ? await fetchArtistAvatarsBatch(missingAvatarIds, config) : {};

  const knownAvatars: Record<string, string> = {};
  const enriched = uniqueArtists.map((artist) => {
    const avatar = artist.imageUrl || fetchedAvatars[artist.id] || fallbackCoverByArtist.get(artist.id);
    if (artist.imageUrl) {
      knownAvatars[artist.id] = artist.imageUrl;
    }
    return toRexArtist({
      ...artist,
      ...(avatar ? { imageUrl: avatar } : {}),
    });
  });

  if (Object.keys(knownAvatars).length) {
    cacheArtistAvatars(knownAvatars);
  }
  return dedupeVideoItems(enriched);
}

async function fetchCuratedCategoryArtists(
  cat: string,
  offset: number,
  config: RuntimeConfig,
): Promise<VideoItem[] | null> {
  const matched = CURATED_GENRES.find((genre) => genre.id === cat);
  if (!matched) {
    return null;
  }

  if (matched.styleTagId) {
    try {
      const response = await eapiRequest<{ data?: { artists?: unknown[] } }>(
        "/api/style-tag/home/artist",
        { tagId: matched.styleTagId, cursor: offset, size: DEFAULT_PAGE_SIZE, sort: 0 },
        config,
        { timeout: 8 },
      );
      const artists = (Array.isArray(response.data?.artists) ? response.data.artists : [])
        .map(parseArtist)
        .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
      if (artists.length) {
        const avatars: Record<string, string> = {};
        for (const artist of artists) {
          if (artist.imageUrl) avatars[artist.id] = artist.imageUrl;
        }
        cacheArtistAvatars(avatars);
        return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
      }
    } catch {
      // Fall through to playlist-derived artists
    }
  }

  if (matched.artistArea) {
    try {
      const response = await eapiRequest<{ artists?: unknown[] }>(
        "/api/v1/artist/list",
        {
          area: ARTIST_AREA_CODES[matched.artistArea],
          type: -1,
          limit: DEFAULT_PAGE_SIZE,
          offset,
          total: true,
        },
        config,
        { timeout: 8 },
      );
      const artists = (Array.isArray(response.artists) ? response.artists : [])
        .map(parseArtist)
        .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
      if (artists.length) {
        const avatars: Record<string, string> = {};
        for (const artist of artists) {
          if (artist.imageUrl) avatars[artist.id] = artist.imageUrl;
        }
        cacheArtistAvatars(avatars);
        return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
      }
    } catch {
      // Fall through to playlist-derived artists
    }
  }

  return null;
}

async function loadGenresList(
  params: CommonGlobalParams & PaginationParams & { genreId?: string; section?: string; source?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const rawGenreId = stripPrefix((params.genreId || "").trim(), LINK_PREFIX.genre);

  if (!rawGenreId) {
    const source = (params.source || "all") as "all" | "styles" | "highquality";

    if (source === "styles") {
      const response = await eapiRequest<{ data?: unknown[] }>("/api/tag/list/get", {}, config);
      const styleTags = (Array.isArray(response.data) ? response.data : [])
        .map(parseStyleTag)
        .filter((item): item is NcmStyleTagRef => item !== null);
      const items: VideoItem[] = styleTags.map((tag) => ({
        id: `style:${tag.tagId}`,
        type: "url",
        mediaType: "genre",
        link: genreLink(`style:${tag.tagId}`),
        title: tag.tagName,
        subtitle: tag.enName || Widget.i18n("曲风馆"),
        genreTitle: tag.tagName,
        ...(tag.imageUrl ? { posterPath: tag.imageUrl, coverUrl: tag.imageUrl } : {}),
      }));
      return sliceByPage(items, params);
    }

    const covers = await fetchCuratedGenreCovers(config);

    if (source === "highquality") {
      const items: VideoItem[] = CURATED_GENRES.map((genre) => {
        const cover = covers[genre.id];
        return {
          id: `hq:${genre.id}`,
          type: "url",
          mediaType: "genre",
          link: genreLink(`hq:${genre.id}`),
          title: Widget.i18n(genre.title),
          subtitle: `${Widget.i18n("精品歌单")} · ${Widget.i18n(genre.subtitle)}`,
          genreTitle: Widget.i18n(genre.title),
          ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
        };
      });
      return sliceByPage(items, params);
    }

    const items: VideoItem[] = CURATED_GENRES.map((genre) => {
      const cover = covers[genre.id];
      return {
        id: genre.id,
        type: "url",
        mediaType: "genre",
        link: genreLink(genre.id),
        title: Widget.i18n(genre.title),
        subtitle: Widget.i18n(genre.subtitle),
        genreTitle: Widget.i18n(genre.title),
        ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
      };
    });
    return sliceByPage(items, params);
  }

  const offset = resolveOffset(params);
  const section = params.section || "albums";

  // Style Hall (`style:<tagId>`) supports native songs, albums/playlists, and artists endpoints
  if (rawGenreId.startsWith("style:") && isValidNumericId(rawGenreId.slice(6))) {
    const tagId = rawGenreId.slice(6);
    if (section === "songs") {
      const response = await eapiRequest<{ data?: { songs?: unknown[] } }>(
        "/api/style-tag/home/song",
        { tagId, cursor: offset, size: DEFAULT_PAGE_SIZE, sort: 0 },
        config,
      );
      const tracks = (Array.isArray(response.data?.songs) ? response.data.songs : [])
        .map(parseTrack)
        .filter((item): item is NcmTrackRef => item !== null);
      const items = dedupeVideoItems(tracks.map(toRexSong));
      cacheTracks(tracks, items);
      return items;
    }

    if (section === "artists") {
      const response = await eapiRequest<{ data?: { artists?: unknown[] } }>(
        "/api/style-tag/home/artist",
        { tagId, cursor: offset, size: DEFAULT_PAGE_SIZE, sort: 0 },
        config,
      );
      const artists = (Array.isArray(response.data?.artists) ? response.data.artists : [])
        .map(parseArtist)
        .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
      return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
    }

    const [albumsRes, playlistsRes] = await Promise.allSettled([
      eapiRequest<{ data?: { albums?: unknown[] } }>(
        "/api/style-tag/home/album",
        { tagId, cursor: offset, size: Math.ceil(DEFAULT_PAGE_SIZE / 2), sort: 0 },
        config,
      ),
      eapiRequest<{ data?: { playlist?: unknown[] } }>(
        "/api/style-tag/home/playlist",
        { tagId, cursor: offset, size: Math.ceil(DEFAULT_PAGE_SIZE / 2), sort: 0 },
        config,
      ),
    ]);

    const out: VideoItem[] = [];
    if (albumsRes.status === "fulfilled") {
      const albums = (Array.isArray(albumsRes.value.data?.albums) ? albumsRes.value.data.albums : [])
        .map(parseAlbum)
        .filter((item): item is NcmAlbumRef => item !== null);
      for (const album of albums) out.push(toRexAlbum(album));
    }
    if (playlistsRes.status === "fulfilled") {
      const playlists = (Array.isArray(playlistsRes.value.data?.playlist) ? playlistsRes.value.data.playlist : [])
        .map(parsePlaylist)
        .filter((item): item is NcmPlaylistRef => item !== null);
      for (const pl of playlists) out.push(toRexPlaylist(pl));
    }
    if (!out.length && albumsRes.status === "rejected") {
      throw albumsRes.reason;
    }
    return dedupeVideoItems(out);
  }

  // High-quality playlist tag (`hq:<cat>`)
  if (rawGenreId.startsWith("hq:")) {
    const cat = rawGenreId.slice(3) || "全部";
    if (section === "artists") {
      const directArtists = await fetchCuratedCategoryArtists(cat, offset, config);
      if (directArtists?.length) {
        return directArtists;
      }
    }
    const response = await eapiRequest<{ playlists?: unknown[] }>(
      "/api/playlist/highquality/list",
      { cat, limit: 60, lasttime: 0, total: true },
      config,
    );
    const playlists = (Array.isArray(response.playlists) ? response.playlists : [])
      .map(parsePlaylist)
      .filter((item): item is NcmPlaylistRef => item !== null);
    if (section === "songs" || section === "artists") {
      const seed = playlists[0];
      if (!seed) {
        return [];
      }
      const { tracks } = await fetchPlaylistTracks(seed.id, config, 60);
      if (section === "artists") {
        const artists = await hydrateArtistsFromTracks(tracks, config);
        return sliceByPage(artists, params);
      }
      const items = dedupeVideoItems(tracks.map(toRexSong));
      cacheTracks(tracks, items);
      return sliceByPage(items, params);
    }
    return sliceByPage(dedupeVideoItems(playlists.map(toRexPlaylist)), params);
  }

  if (section === "artists") {
    const directArtists = await fetchCuratedCategoryArtists(rawGenreId, offset, config);
    if (directArtists?.length) {
      return directArtists;
    }
  }

  const response = await webRequest<{ playlists?: unknown[] }>(
    "/api/playlist/list",
    { cat: rawGenreId, order: "hot", limit: DEFAULT_PAGE_SIZE, offset, total: true },
    config,
  );
  const playlists = (Array.isArray(response.playlists) ? response.playlists : [])
    .map(parsePlaylist)
    .filter((item): item is NcmPlaylistRef => item !== null);

  if (section === "songs" || section === "artists") {
    const seedPlaylist = playlists[0];
    if (!seedPlaylist) {
      return [];
    }
    const { tracks } = await fetchPlaylistTracks(seedPlaylist.id, config, 60);
    if (section === "artists") {
      return hydrateArtistsFromTracks(tracks, config);
    }
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheTracks(tracks, items);
    return items;
  }

  return dedupeVideoItems(playlists.map(toRexPlaylist));
}

async function fetchFmBatch(mode: string, subMode: string, config: RuntimeConfig): Promise<NcmTrackRef[]> {
  if (!parseCookieAuthInput(config.cookie).hasMusicU) {
    throw new Error(Widget.i18n("私人漫游需要配置网易云音乐 Cookie（含 MUSIC_U）"));
  }
  const response = await eapiRequest<{ data?: unknown[] }>("/api/v1/radio/get", { mode, subMode, limit: 10 }, config);
  return (Array.isArray(response.data) ? response.data : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null);
}

async function fetchSportRadioTracks(bpm: number, config: RuntimeConfig): Promise<NcmTrackRef[]> {
  const batches = await Promise.allSettled([
    eapiRequest<{ data?: unknown[] }>("/api/radio/sport/get", { bpm }, config),
    eapiRequest<{ data?: unknown[] }>("/api/radio/sport/get", { bpm }, config),
    eapiRequest<{ data?: unknown[] }>("/api/radio/sport/get", { bpm }, config),
  ]);
  const tracks: NcmTrackRef[] = [];
  for (const res of batches) {
    if (res.status === "fulfilled" && Array.isArray(res.value.data)) {
      for (const raw of res.value.data) {
        const parsed = parseTrack(raw);
        if (parsed) {
          tracks.push(parsed);
        }
      }
    }
  }
  if (!tracks.length && batches[0]?.status === "rejected") {
    throw batches[0].reason;
  }
  return tracks;
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

const FM_MODE_MAP: Record<string, { mode: string; subMode: string }> = {
  "fm:DEFAULT": { mode: "DEFAULT", subMode: "" },
  "fm:FAMILIAR": { mode: "FAMILIAR", subMode: "" },
  "fm:EXPLORE": { mode: "EXPLORE", subMode: "" },
  "fm:SCENE_EXERCISE": { mode: "SCENE_RCMD", subMode: "EXERCISE" },
  "fm:SCENE_FOCUS": { mode: "SCENE_RCMD", subMode: "FOCUS" },
  "fm:SCENE_NIGHT": { mode: "SCENE_RCMD", subMode: "NIGHT_EMO" },
};

async function loadRadiosList(
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
        id: "fm:SCENE_EXERCISE",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:SCENE_EXERCISE"),
        title: Widget.i18n("场景漫游 · 运动"),
        subtitle: Widget.i18n("高燃节奏伴你运动（需配置 Cookie）"),
      },
      {
        id: "fm:SCENE_FOCUS",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:SCENE_FOCUS"),
        title: Widget.i18n("场景漫游 · 专注"),
        subtitle: Widget.i18n("沉浸工作与学习氛围（需配置 Cookie）"),
      },
      {
        id: "fm:SCENE_NIGHT",
        type: "url",
        mediaType: "radio",
        link: radioLink("fm:SCENE_NIGHT"),
        title: Widget.i18n("场景漫游 · 深夜情绪"),
        subtitle: Widget.i18n("治愈深夜情绪的私藏歌单（需配置 Cookie）"),
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
        id: "sport",
        type: "url",
        mediaType: "radio",
        link: radioLink("sport"),
        title: Widget.i18n("跑步漫游"),
        subtitle: Widget.i18n("按 160 BPM 步频推荐的动感节奏"),
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
  const fmConfig = FM_MODE_MAP[rawRadioId];
  if (fmConfig) {
    // Fetch two batches for a richer Rex playback queue
    const [first, second] = await Promise.allSettled([
      fetchFmBatch(fmConfig.mode, fmConfig.subMode, config),
      fetchFmBatch(fmConfig.mode, fmConfig.subMode, config),
    ]);
    if (first.status === "fulfilled") tracks.push(...first.value);
    if (second.status === "fulfilled") tracks.push(...second.value);
    if (!tracks.length && first.status === "rejected") {
      throw first.reason;
    }
  } else if (rawRadioId === "heart") {
    tracks = await fetchHeartModeTracks(config);
  } else if (rawRadioId === "sport") {
    tracks = await fetchSportRadioTracks(160, config);
  } else if (rawRadioId === "radar") {
    tracks = (await fetchPlaylistTracks(PRIVATE_RADAR_PLAYLIST_ID, config, 60)).tracks;
  } else if (rawRadioId.startsWith("pl:") && isValidNumericId(rawRadioId.slice(3))) {
    tracks = (await fetchPlaylistTracks(rawRadioId.slice(3), config, 60)).tracks;
  } else if (rawRadioId.startsWith("dj:") && isValidNumericId(rawRadioId.slice(3))) {
    const { programs } = await fetchDjRadioWithPrograms(rawRadioId.slice(3), config, 60);
    const items = dedupeVideoItems(programs.map(toRexDjProgram));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  } else if (isValidNumericId(rawRadioId)) {
    tracks = (await fetchPlaylistTracks(rawRadioId, config, 60)).tracks;
  }

  const section = params.section || "songs";
  if (section === "artists") {
    const artists = await hydrateArtistsFromTracks(tracks, config);
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
  cacheTracks(tracks, items);
  return sliceByPage(items, params);
}

async function loadPodcastsList(
  params: CommonGlobalParams & PaginationParams & { category?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "recommend") as "recommend" | "hot" | "toplist_hot" | "toplist_new" | "programs";
  const offset = resolveOffset(params);

  if (category === "programs") {
    const response = await eapiRequest<{ toplist?: Array<{ program?: unknown }> }>(
      "/api/program/toplist/v1",
      { limit: DEFAULT_PAGE_SIZE, offset },
      config,
    );
    const programs = (Array.isArray(response.toplist) ? response.toplist : [])
      .map((entry) => parseDjProgram(entry?.program))
      .filter((item): item is NcmDjProgramRef => item !== null);
    const items = dedupeVideoItems(programs.map(toRexDjProgram));
    cacheSongMetaList(items);
    return items;
  }

  if (category === "hot") {
    const response = await eapiRequest<{ djRadios?: unknown[] }>(
      "/api/djradio/hot/v1",
      { limit: DEFAULT_PAGE_SIZE, offset },
      config,
    );
    const radios = (Array.isArray(response.djRadios) ? response.djRadios : [])
      .map(parseDjRadio)
      .filter((item): item is NcmDjRadioRef => item !== null);
    return dedupeVideoItems(radios.map(toRexDjRadio));
  }

  if (category === "toplist_hot" || category === "toplist_new") {
    const type = category === "toplist_hot" ? 1 : 0;
    const response = await eapiRequest<{ toplist?: unknown[] }>(
      "/api/djradio/toplist",
      { type, limit: DEFAULT_PAGE_SIZE, offset },
      config,
    );
    const radios = (Array.isArray(response.toplist) ? response.toplist : [])
      .map(parseDjRadio)
      .filter((item): item is NcmDjRadioRef => item !== null);
    return dedupeVideoItems(radios.map(toRexDjRadio));
  }

  const response = await eapiRequest<{ djRadios?: unknown[] }>("/api/djradio/recommend/v1", {}, config);
  const radios = (Array.isArray(response.djRadios) ? response.djRadios : [])
    .map(parseDjRadio)
    .filter((item): item is NcmDjRadioRef => item !== null);
  return sliceByPage(dedupeVideoItems(radios.map(toRexDjRadio)), params);
}

async function loadArtistsList(
  params: CommonGlobalParams &
    PaginationParams & { peopleId?: string; section?: string; area?: string; artistType?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const peopleId = (params.peopleId || "").trim();
  const offset = resolveOffset(params);

  if (!peopleId) {
    const area = normalizeArtistArea(params.area);
    const artistType = normalizeArtistType(params.artistType);

    if (area !== "ALL" || artistType !== "ALL") {
      const response = await eapiRequest<{ artists?: unknown[] }>(
        "/api/v1/artist/list",
        {
          area: ARTIST_AREA_CODES[area],
          type: ARTIST_TYPE_CODES[artistType],
          limit: DEFAULT_PAGE_SIZE,
          offset,
          total: true,
        },
        config,
      );
      const artists = (Array.isArray(response.artists) ? response.artists : [])
        .map(parseArtist)
        .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
      return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
    }

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
    const [baseRes, descRes] = await Promise.allSettled([
      webRequest<{ artist?: JsonRecord }>(`/api/v1/artist/${peopleId}`, {}, config),
      eapiRequest<{ briefDesc?: string; introduction?: Array<{ ti?: string; txt?: string }> }>(
        "/api/artist/introduction",
        { id: peopleId },
        config,
        { timeout: 6 },
      ),
    ]);
    if (baseRes.status === "rejected") {
      throw baseRes.reason;
    }
    const artist = parseArtist(baseRes.value.artist);
    if (!artist) {
      return [];
    }
    const rawArtist = baseRes.value.artist || {};
    const briefDesc =
      (descRes.status === "fulfilled" && typeof descRes.value.briefDesc === "string"
        ? descRes.value.briefDesc.trim()
        : "") || (typeof rawArtist.briefDesc === "string" ? rawArtist.briefDesc.trim() : "");
    const musicSize = Number(rawArtist.musicSize) || 0;
    const albumSize = Number(rawArtist.albumSize) || 0;
    const stats = [
      musicSize > 0 ? `${musicSize} ${Widget.i18n("首歌曲")}` : "",
      albumSize > 0 ? `${albumSize} ${Widget.i18n("张专辑")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const introParts: string[] = [];
    if (descRes.status === "fulfilled" && Array.isArray(descRes.value.introduction)) {
      for (const section of descRes.value.introduction.slice(0, 3)) {
        const ti = typeof section?.ti === "string" ? section.ti.trim() : "";
        const txt = typeof section?.txt === "string" ? section.txt.trim() : "";
        if (ti && txt) {
          introParts.push(`${ti}\n${txt}`);
        }
      }
    }

    const description = [stats, briefDesc, ...introParts].filter(Boolean).join("\n\n") || undefined;
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
      cacheTracks(tracks, items);
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
  cacheTracks(tracks, items);
  return items;
}

async function loadLibraryList(params: CommonGlobalParams & PaginationParams & { tab?: string }): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const tab = (params.tab || "liked") as
    | "liked"
    | "playlists"
    | "cloud"
    | "recent_songs"
    | "recent_albums"
    | "recent_playlists"
    | "sub_albums"
    | "sub_artists"
    | "sub_podcasts"
    | "recent_week"
    | "recent_all";
  const offset = resolveOffset(params);

  const { uid } = await resolveAccountUid(config);
  const cookieKey = parseCookieAuthInput(config.cookie).cookies.MUSIC_U || "";

  if (tab === "recent_songs") {
    const response = await eapiRequest<{ data?: { list?: Array<{ data?: unknown }> } }>(
      "/api/play-record/song/list",
      { limit: 100 },
      config,
    );
    const tracks = (Array.isArray(response.data?.list) ? response.data.list : [])
      .map((entry) => parseTrack(entry?.data))
      .filter((item): item is NcmTrackRef => item !== null);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheTracks(tracks, items);
    return sliceByPage(items, params);
  }

  if (tab === "recent_albums") {
    const response = await eapiRequest<{ data?: { list?: Array<{ data?: unknown }> } }>(
      "/api/play-record/album/list",
      { limit: 100 },
      config,
    );
    const albums = (Array.isArray(response.data?.list) ? response.data.list : [])
      .map((entry) => parseAlbum(entry?.data))
      .filter((item): item is NcmAlbumRef => item !== null);
    return sliceByPage(dedupeVideoItems(albums.map(toRexAlbum)), params);
  }

  if (tab === "recent_playlists") {
    const response = await eapiRequest<{ data?: { list?: Array<{ data?: unknown }> } }>(
      "/api/play-record/playlist/list",
      { limit: 100 },
      config,
    );
    const playlists = (Array.isArray(response.data?.list) ? response.data.list : [])
      .map((entry) => parsePlaylist(entry?.data))
      .filter((item): item is NcmPlaylistRef => item !== null);
    return sliceByPage(dedupeVideoItems(playlists.map(toRexPlaylist)), params);
  }

  if (tab === "sub_albums") {
    const response = await eapiRequest<{ data?: unknown[] }>(
      "/api/album/sublist",
      { limit: DEFAULT_PAGE_SIZE, offset, total: true },
      config,
    );
    const albums = (Array.isArray(response.data) ? response.data : [])
      .map(parseAlbum)
      .filter((item): item is NcmAlbumRef => item !== null);
    mergeCachedFavoriteIds(
      cookieKey,
      "albums",
      albums.map((a) => a.id),
    );
    return dedupeVideoItems(albums.map(toRexAlbum));
  }

  if (tab === "sub_artists") {
    const response = await eapiRequest<{ data?: unknown[] }>(
      "/api/artist/sublist",
      { limit: DEFAULT_PAGE_SIZE, offset, total: true },
      config,
    );
    const artists = (Array.isArray(response.data) ? response.data : [])
      .map(parseArtist)
      .filter((item): item is NcmArtistRef => item !== null && Boolean(item.id));
    mergeCachedFavoriteIds(
      cookieKey,
      "artists",
      artists.map((a) => a.id),
    );
    return dedupeVideoItems(artists.map((a) => toRexArtist(a)));
  }

  if (tab === "sub_podcasts") {
    const response = await eapiRequest<{ djRadios?: unknown[] }>(
      "/api/djradio/get/subed",
      { limit: DEFAULT_PAGE_SIZE, offset, total: true },
      config,
    );
    const radios = (Array.isArray(response.djRadios) ? response.djRadios : [])
      .map(parseDjRadio)
      .filter((item): item is NcmDjRadioRef => item !== null);
    mergeCachedFavoriteIds(
      cookieKey,
      "podcasts",
      radios.map((r) => r.id),
    );
    return dedupeVideoItems(radios.map(toRexDjRadio));
  }

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
    cacheTracks(tracks, items);
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
    cacheTracks(tracks, items);
    return sliceByPage(items, params);
  }

  const plResponse = await webRequest<{
    playlist?: Array<JsonRecord & { specialType?: number; subscribed?: boolean; userId?: number | string }>;
  }>(
    "/api/user/playlist",
    { uid, limit: tab === "playlists" ? DEFAULT_PAGE_SIZE : 30, offset: tab === "playlists" ? offset : 0 },
    config,
  );
  const rawPlaylists = Array.isArray(plResponse.playlist) ? plResponse.playlist : [];
  const subscribedPlaylistIds: string[] = [];
  const ownedPlaylistIds: string[] = [];
  for (const pl of rawPlaylists) {
    const id = pl?.id !== undefined ? String(pl.id) : "";
    if (!isValidNumericId(id)) {
      continue;
    }
    if (pl.subscribed === true) {
      subscribedPlaylistIds.push(id);
    } else if (pl.userId !== undefined && String(pl.userId) === uid) {
      ownedPlaylistIds.push(id);
    }
  }
  if (subscribedPlaylistIds.length) {
    mergeCachedFavoriteIds(cookieKey, "playlists", subscribedPlaylistIds);
  }
  if (ownedPlaylistIds.length) {
    mergeCachedFavoriteIds(cookieKey, "ownedPlaylists", ownedPlaylistIds);
  }

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
  mergeCachedFavoriteIds(
    cookieKey,
    "songs",
    tracks.map((t) => t.id),
  );
  const items = dedupeVideoItems(tracks.map(toRexSong));
  cacheTracks(tracks, items);
  return sliceByPage(items, params);
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

async function fetchHotSearchItems(params: PaginationParams, config: RuntimeConfig): Promise<VideoItem[]> {
  try {
    const response = await eapiRequest<{
      data?: Array<{
        searchWord?: string;
        content?: string;
        score?: number;
        iconUrl?: string;
      }>;
    }>("/api/hotsearchlist/get", {}, config, { timeout: 10 });
    const rows = Array.isArray(response.data) ? response.data : [];
    const items: VideoItem[] = [];
    rows.forEach((entry, index) => {
      const word = typeof entry?.searchWord === "string" ? entry.searchWord.trim() : "";
      if (!word) {
        return;
      }
      const rank = index + 1;
      const content = typeof entry.content === "string" ? entry.content.trim() : "";
      const score = Number(entry.score) || 0;
      const subtitle = content || (score > 0 ? `${Widget.i18n("热搜")} · ${score}` : Widget.i18n("网易云热搜榜"));
      const icon = formatCoverUrl(typeof entry.iconUrl === "string" ? entry.iconUrl : undefined);
      items.push({
        id: `hot:${rank}`,
        type: "url",
        mediaType: "playlist",
        link: hotSearchLink(word),
        title: `${rank}. ${word}`,
        subtitle,
        ...(icon ? { posterPath: icon, coverUrl: icon } : {}),
      });
    });
    return sliceByPage(items, params);
  } catch {
    return [];
  }
}

async function loadSearchList(
  params: CommonGlobalParams & PaginationParams & { keyword?: string; kind?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const keyword = (params.keyword || "").trim();
  if (!keyword) {
    return fetchHotSearchItems(params, config);
  }

  const kind = (params.kind || "all") as SearchKind;
  const page = parsePage(params.page);
  const offset = resolveOffset(params);

  if (kind === "voices") {
    const response = await eapiRequest<{
      data?: { resources?: Array<{ baseInfo?: unknown }> };
    }>("/api/search/voice/get", { keyword, scene: "normal", limit: DEFAULT_PAGE_SIZE, offset }, config);
    const resources = Array.isArray(response.data?.resources) ? response.data.resources : [];
    const programs = resources
      .map((entry) => parseDjProgram(entry?.baseInfo))
      .filter((item): item is NcmDjProgramRef => item !== null);
    const items = dedupeVideoItems(programs.map(toRexDjProgram));
    cacheSongMetaList(items);
    return items;
  }

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
      const tracks: NcmTrackRef[] = [];
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
        for (const song of songs) {
          tracks.push(song);
          out.push(toRexSong(song));
        }
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
      cacheTracks(tracks, deduped);
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
    cacheTracks(songs, items);
    return items;
  }

  const typeCode = SEARCH_TYPE_CODES[kind];
  const response = await webRequest<{
    result?: {
      songs?: Array<JsonRecord & { lyrics?: string[] }>;
      albums?: unknown[];
      artists?: unknown[];
      playlists?: unknown[];
      djRadios?: unknown[];
    };
  }>("/api/cloudsearch/pc", { s: keyword, type: typeCode, limit: DEFAULT_PAGE_SIZE, offset, total: true }, config, {
    method: "POST",
  });

  if (kind === "songs" || kind === "lyrics") {
    const rawSongs = Array.isArray(response.result?.songs) ? response.result.songs : [];
    const tracks: NcmTrackRef[] = [];
    const items: VideoItem[] = [];
    for (const rawSong of rawSongs) {
      const parsed = parseTrack(rawSong);
      if (!parsed) {
        continue;
      }
      tracks.push(parsed);
      const rexItem = toRexSong(parsed);
      if (kind === "lyrics" && Array.isArray(rawSong?.lyrics) && rawSong.lyrics.length) {
        const snippet = rawSong.lyrics
          .slice(0, 3)
          .map((line) => (typeof line === "string" ? stripHtmlTags(line) : ""))
          .filter(Boolean)
          .join("\n");
        if (snippet) {
          rexItem.description = snippet;
        }
      }
      items.push(rexItem);
    }
    const deduped = dedupeVideoItems(items);
    cacheTracks(tracks, deduped);
    return deduped;
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
  if (kind === "dj") {
    const radios = (Array.isArray(response.result?.djRadios) ? response.result.djRadios : [])
      .map(parseDjRadio)
      .filter((item): item is NcmDjRadioRef => item !== null);
    return dedupeVideoItems(radios.map(toRexDjRadio));
  }
  const playlists = (Array.isArray(response.result?.playlists) ? response.result.playlists : [])
    .map(parsePlaylist)
    .filter((item): item is NcmPlaylistRef => item !== null);
  return dedupeVideoItems(playlists.map(toRexPlaylist));
}

async function fetchSimilarSongs(songId: string, config: RuntimeConfig): Promise<VideoItem[]> {
  try {
    const response = await eapiRequest<{ songs?: unknown[] }>(
      "/api/v1/discovery/simiSong",
      { songid: songId, limit: 10, offset: 0 },
      config,
      { timeout: 6 },
    );
    const tracks = (Array.isArray(response.songs) ? response.songs : [])
      .map(parseTrack)
      .filter((item): item is NcmTrackRef => item !== null && item.id !== songId);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheTracks(tracks, items);
    return items;
  } catch {
    return [];
  }
}

async function fetchRelatedPlaylists(playlistId: string, config: RuntimeConfig): Promise<VideoItem[]> {
  try {
    const response = await eapiRequest<{
      data?: { recPlaylist?: Array<{ playlist?: unknown }> };
    }>("/api/playlist/detail/rcmd/get", { scene: "playlist_head", playlistId, newStyle: "true" }, config, {
      timeout: 6,
    });
    const rows = Array.isArray(response.data?.recPlaylist) ? response.data.recPlaylist : [];
    const playlists = rows
      .map((entry) => parsePlaylist(entry?.playlist))
      .filter((item): item is NcmPlaylistRef => item !== null && item.id !== playlistId);
    return dedupeVideoItems(playlists.map(toRexPlaylist));
  } catch {
    return [];
  }
}

async function loadSongDetail(songId: string, config: RuntimeConfig): Promise<VideoItem> {
  let cachedMeta = getCachedSongMeta(songId);
  const shouldScrobble = config.reportHistory && parseCookieAuthInput(config.cookie).hasMusicU;
  const scrobbleUpfront = shouldScrobble && Boolean(cachedMeta);

  const [stream, fetchedMeta, relatedItems, dynamicCover] = await Promise.all([
    resolveAudioStream(songId, config),
    cachedMeta
      ? Promise.resolve(null)
      : fetchSongDetails([songId], config)
          .then((list) => list[0] ?? null)
          .catch(() => null),
    fetchSimilarSongs(songId, config),
    fetchSongDynamicCover(songId, config).catch(() => undefined),
    scrobbleUpfront
      ? scrobbleSong(songId, cachedMeta?.albumId, cachedMeta?.duration || 180, config).catch(() => undefined)
      : Promise.resolve(),
  ]);

  if (!cachedMeta && fetchedMeta) {
    const rexItem = toRexSong(fetchedMeta);
    cacheTracks([fetchedMeta], [rexItem]);
    cachedMeta = {
      id: songId,
      title: rexItem.title,
      subtitle: rexItem.subtitle,
      posterPath: rexItem.posterPath,
      coverUrl: rexItem.coverUrl,
      duration: rexItem.duration,
      durationText: rexItem.durationText,
      peoples: rexItem.peoples,
      mvId: fetchedMeta.mvId,
      albumId: fetchedMeta.album?.id,
    };
  }

  const mvId = cachedMeta?.mvId || fetchedMeta?.mvId || 0;
  const duration = cachedMeta?.duration || 0;

  const [mvUrl] = await Promise.all([
    mvId > 0 ? fetchMvUrl(mvId, config).catch(() => undefined) : Promise.resolve(undefined),
    shouldScrobble && !scrobbleUpfront
      ? scrobbleSong(songId, cachedMeta?.albumId, duration || 180, config).catch(() => undefined)
      : Promise.resolve(),
  ]);

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
    ...(dynamicCover ? { albumMotionArtwork: dynamicCover } : {}),
    ...(mvUrl ? { trailers: [{ ...(cover ? { coverUrl: cover } : {}), videoUrl: mvUrl }] } : {}),
    ...(relatedItems.length ? { relatedItems } : {}),
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
  cacheTracks(rawSongs, rexTracks);

  const artistNames = album.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join(" / ");
  const peoples = toRexPeoples(album.artists);
  const cover = formatCoverUrl(album.imageUrl);
  const metaLine = [album.subType || "", album.company || ""].filter(Boolean).join(" · ");
  const description = [metaLine, album.description || ""].filter(Boolean).join("\n") || undefined;

  return {
    id: album.id,
    type: "url",
    mediaType: "album",
    link: `ncm:album:${album.id}`,
    title: album.name,
    ...(artistNames ? { subtitle: artistNames } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(album.released ? { releaseDate: album.released } : {}),
    ...(description ? { description } : {}),
    ...(peoples ? { peoples } : {}),
    tracks: rexTracks,
  };
}

async function loadPlaylistDetail(playlistId: string, config: RuntimeConfig): Promise<VideoItem> {
  const [{ playlist, tracks }, relatedItems] = await Promise.all([
    fetchPlaylistTracks(playlistId, config, MAX_PLAYLIST_TRACKS),
    fetchRelatedPlaylists(playlistId, config),
  ]);
  const rexTracks = tracks.map(toRexSong);
  cacheTracks(tracks, rexTracks);
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
    ...(relatedItems.length ? { relatedItems } : {}),
    tracks: rexTracks,
  };
}

async function loadPodcastDetail(radioId: string, config: RuntimeConfig): Promise<VideoItem> {
  const { radio, programs } = await fetchDjRadioWithPrograms(radioId, config, MAX_PODCAST_PROGRAMS);
  const rexTracks = programs.map(toRexDjProgram);
  cacheSongMetaList(rexTracks);
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
    tracks: rexTracks,
  };
}

async function loadHotSearchDetail(keyword: string, config: RuntimeConfig): Promise<VideoItem> {
  const response = await webRequest<{ result?: { songs?: unknown[] } }>(
    "/api/cloudsearch/pc",
    { s: keyword, type: SEARCH_TYPE_CODES.songs, limit: DEFAULT_PAGE_SIZE, offset: 0, total: true },
    config,
    { method: "POST" },
  );
  const tracks = (Array.isArray(response.result?.songs) ? response.result.songs : [])
    .map(parseTrack)
    .filter((item): item is NcmTrackRef => item !== null);
  const rexTracks = dedupeVideoItems(tracks.map(toRexSong));
  cacheTracks(tracks, rexTracks);
  const cover = rexTracks[0]?.posterPath || rexTracks[0]?.coverUrl;

  return {
    id: `hot:${keyword}`,
    type: "url",
    mediaType: "playlist",
    link: hotSearchLink(keyword),
    title: keyword,
    subtitle: Widget.i18n("网易云热搜榜"),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    tracks: rexTracks,
  };
}

type FavoriteKind = "song" | "playlist" | "album" | "artist" | "podcast";

interface FavoriteStateSnapshot {
  songs: Set<string>;
  playlists: Set<string>;
  ownedPlaylists: Set<string>;
  albums: Set<string>;
  artists: Set<string>;
  podcasts: Set<string>;
}

function classifyFavoriteItem(item: VideoItemChild): { kind: FavoriteKind; resourceId: string } | null {
  const id = String(item.id ?? "").trim();
  if (!id) {
    return null;
  }
  if (item.mediaType === "song" && isValidNumericId(id)) {
    return { kind: "song", resourceId: id };
  }
  if (item.mediaType === "album" && isValidNumericId(id)) {
    return { kind: "album", resourceId: id };
  }
  if (item.mediaType === "playlist") {
    if (isValidNumericId(id)) {
      return { kind: "playlist", resourceId: id };
    }
    if (id.startsWith("dj:")) {
      const radioId = id.slice(3);
      if (isValidNumericId(radioId)) {
        return { kind: "podcast", resourceId: radioId };
      }
    }
  }
  if ((item.type === "person" || item.mediaType === "person") && isValidNumericId(id)) {
    return { kind: "artist", resourceId: id };
  }
  return null;
}

async function hydrateFavoriteStates(
  items: readonly VideoItemChild[],
  config: RuntimeConfig,
): Promise<FavoriteStateSnapshot | null> {
  const parsedAuth = parseCookieAuthInput(config.cookie);
  if (!parsedAuth.hasMusicU) {
    return null;
  }
  const cookieKey = parsedAuth.cookies.MUSIC_U;
  const needed = new Set<FavoriteKind>();
  for (const item of items) {
    const classified = classifyFavoriteItem(item);
    if (classified) {
      needed.add(classified.kind);
    }
  }
  if (!needed.size) {
    return null;
  }

  let songs = getCachedFavoriteIds(cookieKey, "songs");
  let playlists = getCachedFavoriteIds(cookieKey, "playlists");
  let ownedPlaylists = getCachedFavoriteIds(cookieKey, "ownedPlaylists");
  let albums = getCachedFavoriteIds(cookieKey, "albums");
  let artists = getCachedFavoriteIds(cookieKey, "artists");
  let podcasts = getCachedFavoriteIds(cookieKey, "podcasts");

  const tasks: Promise<void>[] = [];
  if (needed.has("song") && songs === null) {
    tasks.push(
      fetchLikedSongIds(config)
        .then((ids) => {
          setCachedFavoriteIds(cookieKey, "songs", ids);
          songs = new Set(ids);
        })
        .catch(() => undefined),
    );
  }
  if (needed.has("playlist") && playlists === null) {
    tasks.push(
      fetchUserPlaylistOwnership(config)
        .then(({ subscribed, owned }) => {
          setCachedFavoriteIds(cookieKey, "playlists", subscribed);
          setCachedFavoriteIds(cookieKey, "ownedPlaylists", owned);
          playlists = new Set(subscribed);
          ownedPlaylists = new Set(owned);
        })
        .catch(() => undefined),
    );
  }
  if (needed.has("album") && albums === null) {
    tasks.push(
      fetchSubscribedAlbumIds(config)
        .then((ids) => {
          setCachedFavoriteIds(cookieKey, "albums", ids);
          albums = new Set(ids);
        })
        .catch(() => undefined),
    );
  }
  if (needed.has("artist") && artists === null) {
    tasks.push(
      fetchSubscribedArtistIds(config)
        .then((ids) => {
          setCachedFavoriteIds(cookieKey, "artists", ids);
          artists = new Set(ids);
        })
        .catch(() => undefined),
    );
  }
  if (needed.has("podcast") && podcasts === null) {
    tasks.push(
      fetchSubscribedPodcastIds(config)
        .then((ids) => {
          setCachedFavoriteIds(cookieKey, "podcasts", ids);
          podcasts = new Set(ids);
        })
        .catch(() => undefined),
    );
  }

  if (tasks.length) {
    await Promise.allSettled(tasks);
  }

  return {
    songs: songs ?? new Set<string>(),
    playlists: playlists ?? new Set<string>(),
    ownedPlaylists: ownedPlaylists ?? new Set<string>(),
    albums: albums ?? new Set<string>(),
    artists: artists ?? new Set<string>(),
    podcasts: podcasts ?? new Set<string>(),
  };
}

function buildFavoriteAction(item: VideoItemChild, state: FavoriteStateSnapshot): WidgetAction | null {
  const classified = classifyFavoriteItem(item);
  if (!classified) {
    return null;
  }
  switch (classified.kind) {
    case "song": {
      const liked = state.songs.has(classified.resourceId);
      return {
        id: liked ? ITEM_ACTION_IDS.unlikeSong : ITEM_ACTION_IDS.likeSong,
        title: Widget.i18n(liked ? "取消红心" : "红心喜欢"),
        functionName: FAVORITE_ACTION_FN,
      };
    }
    case "playlist": {
      if (state.ownedPlaylists.has(classified.resourceId)) {
        return null;
      }
      const subscribed = state.playlists.has(classified.resourceId);
      return {
        id: subscribed ? ITEM_ACTION_IDS.unsubPlaylist : ITEM_ACTION_IDS.subPlaylist,
        title: Widget.i18n(subscribed ? "取消收藏" : "收藏歌单"),
        functionName: FAVORITE_ACTION_FN,
      };
    }
    case "album": {
      const subscribed = state.albums.has(classified.resourceId);
      return {
        id: subscribed ? ITEM_ACTION_IDS.unsubAlbum : ITEM_ACTION_IDS.subAlbum,
        title: Widget.i18n(subscribed ? "取消收藏" : "收藏专辑"),
        functionName: FAVORITE_ACTION_FN,
      };
    }
    case "artist": {
      const subscribed = state.artists.has(classified.resourceId);
      return {
        id: subscribed ? ITEM_ACTION_IDS.unsubArtist : ITEM_ACTION_IDS.subArtist,
        title: Widget.i18n(subscribed ? "取消关注" : "关注歌手"),
        functionName: FAVORITE_ACTION_FN,
      };
    }
    case "podcast": {
      const subscribed = state.podcasts.has(classified.resourceId);
      return {
        id: subscribed ? ITEM_ACTION_IDS.unsubPodcast : ITEM_ACTION_IDS.subPodcast,
        title: Widget.i18n(subscribed ? "取消订阅" : "订阅播客"),
        functionName: FAVORITE_ACTION_FN,
      };
    }
  }
}

function applyFavoriteAction<T extends VideoItemChild>(item: T, state: FavoriteStateSnapshot): T {
  const action = buildFavoriteAction(item, state);
  if (!action) {
    return item;
  }
  const existing = (item.actions ?? []).filter((entry) => entry.functionName !== FAVORITE_ACTION_FN);
  return {
    ...item,
    actions: [action, ...existing],
  };
}

async function attachFavoriteActionsToList(items: VideoItem[], config: RuntimeConfig): Promise<VideoItem[]> {
  if (!items.length) {
    return items;
  }
  const state = await hydrateFavoriteStates(items, config);
  if (!state) {
    return items;
  }
  return items.map((item) => applyFavoriteAction(item, state));
}

async function attachFavoriteActionsToDetail(detail: VideoItem, config: RuntimeConfig): Promise<VideoItem> {
  const allItems: VideoItemChild[] = [
    detail,
    ...(detail.tracks ?? []),
    ...(detail.childItems ?? []),
    ...(detail.relatedItems ?? []),
  ];
  const state = await hydrateFavoriteStates(allItems, config);
  if (!state) {
    return detail;
  }
  const enriched = applyFavoriteAction(detail, state);
  return {
    ...enriched,
    ...(detail.tracks ? { tracks: detail.tracks.map((item) => applyFavoriteAction(item, state)) } : {}),
    ...(detail.childItems ? { childItems: detail.childItems.map((item) => applyFavoriteAction(item, state)) } : {}),
    ...(detail.relatedItems
      ? { relatedItems: detail.relatedItems.map((item) => applyFavoriteAction(item, state)) }
      : {}),
  };
}

function withFavoriteActions<P extends CommonGlobalParams>(
  loader: (params: P) => Promise<VideoItem[]>,
): (params: P) => Promise<VideoItem[]> {
  return async (params: P) => {
    const items = await loader(params);
    return attachFavoriteActionsToList(items, getRuntimeConfig());
  };
}

export const handleHome = withFavoriteActions(loadHomeList);
export const handleBanners = withFavoriteActions(loadBannersList);
export const handleCharts = withFavoriteActions(loadChartsList);
export const handleNewReleases = withFavoriteActions(loadNewReleasesList);
export const handleGenres = withFavoriteActions(loadGenresList);
export const handleRadios = withFavoriteActions(loadRadiosList);
export const handlePodcasts = withFavoriteActions(loadPodcastsList);
export const handleArtists = withFavoriteActions(loadArtistsList);
export const handleLibrary = withFavoriteActions(loadLibraryList);
export const handleSearch = withFavoriteActions(loadSearchList);

export async function handleToggleFavorite(
  params: CommonGlobalParams & WidgetItemActionParams,
): Promise<WidgetActionResult> {
  const config = syncRuntimeConfig(params);
  const parsedAuth = parseCookieAuthInput(config.cookie);
  if (!parsedAuth.hasMusicU) {
    return { message: Widget.i18n("请在模块设置中填写包含 MUSIC_U 的网易云音乐 Cookie 后操作") };
  }
  const cookieKey = parsedAuth.cookies.MUSIC_U;
  const actionId = (params.actionId || "").trim();
  const rawItemId = String(params.itemId || "").trim();

  switch (actionId) {
    case ITEM_ACTION_IDS.likeSong:
    case ITEM_ACTION_IDS.unlikeSong: {
      const songId = stripPrefix(rawItemId, LINK_PREFIX.song);
      if (!isValidNumericId(songId)) {
        return { message: Widget.i18n("无法识别该歌曲 ID") };
      }
      const like = actionId === ITEM_ACTION_IDS.likeSong;
      await toggleSongLike(songId, like, config);
      updateCachedFavoriteId(cookieKey, "songs", songId, like);
      return {
        message: Widget.i18n(like ? "已加入我喜欢的音乐" : "已取消红心喜欢"),
        refresh: true,
      };
    }
    case ITEM_ACTION_IDS.subPlaylist:
    case ITEM_ACTION_IDS.unsubPlaylist: {
      const playlistId = stripPrefix(rawItemId, LINK_PREFIX.playlist);
      if (!isValidNumericId(playlistId)) {
        return { message: Widget.i18n("无法识别该歌单 ID") };
      }
      const subscribe = actionId === ITEM_ACTION_IDS.subPlaylist;
      await togglePlaylistSubscribe(playlistId, subscribe, config);
      updateCachedFavoriteId(cookieKey, "playlists", playlistId, subscribe);
      return {
        message: Widget.i18n(subscribe ? "已收藏歌单" : "已取消收藏歌单"),
        refresh: true,
      };
    }
    case ITEM_ACTION_IDS.subAlbum:
    case ITEM_ACTION_IDS.unsubAlbum: {
      const albumId = stripPrefix(rawItemId, LINK_PREFIX.album);
      if (!isValidNumericId(albumId)) {
        return { message: Widget.i18n("无法识别该专辑 ID") };
      }
      const subscribe = actionId === ITEM_ACTION_IDS.subAlbum;
      await toggleAlbumSubscribe(albumId, subscribe, config);
      updateCachedFavoriteId(cookieKey, "albums", albumId, subscribe);
      return {
        message: Widget.i18n(subscribe ? "已收藏专辑" : "已取消收藏专辑"),
        refresh: true,
      };
    }
    case ITEM_ACTION_IDS.subArtist:
    case ITEM_ACTION_IDS.unsubArtist: {
      const artistId = stripPrefix(rawItemId, "ncm:artist:");
      if (!isValidNumericId(artistId)) {
        return { message: Widget.i18n("无法识别该歌手 ID") };
      }
      const subscribe = actionId === ITEM_ACTION_IDS.subArtist;
      await toggleArtistSubscribe(artistId, subscribe, config);
      updateCachedFavoriteId(cookieKey, "artists", artistId, subscribe);
      return {
        message: Widget.i18n(subscribe ? "已关注歌手" : "已取消关注歌手"),
        refresh: true,
      };
    }
    case ITEM_ACTION_IDS.subPodcast:
    case ITEM_ACTION_IDS.unsubPodcast: {
      const radioId = stripPrefix(stripPrefix(rawItemId, LINK_PREFIX.dj), "dj:");
      if (!isValidNumericId(radioId)) {
        return { message: Widget.i18n("无法识别该播客 ID") };
      }
      const subscribe = actionId === ITEM_ACTION_IDS.subPodcast;
      await togglePodcastSubscribe(radioId, subscribe, config);
      updateCachedFavoriteId(cookieKey, "podcasts", radioId, subscribe);
      return {
        message: Widget.i18n(subscribe ? "已订阅播客" : "已取消订阅播客"),
        refresh: true,
      };
    }
    default:
      return { message: Widget.i18n("不支持的操作") };
  }
}

export async function handleDetail(link: string): Promise<VideoItem> {
  const parsed = parseDetailLink(link);
  if (!parsed) {
    throw new Error(`${Widget.i18n("无法识别的详情链接")}: ${link}`);
  }
  const config = getRuntimeConfig();

  let detail: VideoItem;
  if (parsed.kind === "song") {
    detail = await loadSongDetail(parsed.id, config);
  } else if (parsed.kind === "album") {
    detail = await loadAlbumDetail(parsed.id, config);
  } else if (parsed.kind === "dj") {
    detail = await loadPodcastDetail(parsed.id, config);
  } else if (parsed.kind === "hot") {
    detail = await loadHotSearchDetail(parsed.keyword, config);
  } else {
    detail = await loadPlaylistDetail(parsed.id, config);
  }
  return attachFavoriteActionsToDetail(detail, config);
}

function resolveSongIdFromSubtitleParams(params: { id?: string; link?: string }): string {
  if (params.link) {
    const parsed = parseDetailLink(params.link);
    if (parsed?.kind === "song") {
      return parsed.id;
    }
  }
  const rawId = (params.id || "").trim();
  if (isValidNumericId(rawId)) {
    return rawId;
  }
  const parsedFromId = parseDetailLink(rawId);
  if (parsedFromId?.kind === "song") {
    return parsedFromId.id;
  }
  return "";
}

export async function handleSubtitle(
  params: CommonGlobalParams & {
    id?: string;
    link?: string;
    title?: string;
    seriesName?: string;
    episodeName?: string;
  },
): Promise<SubtitleItem[]> {
  const config = syncRuntimeConfig(params);
  let songId = resolveSongIdFromSubtitleParams(params);

  if (!songId) {
    const query = [params.title || params.episodeName || "", params.seriesName || ""]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!query) {
      return [];
    }
    const searchRes = await webRequest<{ result?: { songs?: unknown[] } }>(
      "/api/cloudsearch/pc",
      { s: query, type: SEARCH_TYPE_CODES.songs, limit: 1, offset: 0, total: true },
      config,
      { method: "POST" },
    );
    const first = Array.isArray(searchRes.result?.songs) ? parseTrack(searchRes.result.songs[0]) : null;
    if (!first) {
      return [];
    }
    songId = first.id;
  }

  const lyricRes = await fetchSongLyric(songId, config);
  return buildLyricSubtitleItems(songId, lyricRes);
}
