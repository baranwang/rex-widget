import {
  browseById,
  browseContinuation,
  callInnertube,
  enrichTrackDurations,
  reportPlaybackHistory,
  resolveAudioStream,
  resolvePlayerType,
} from "./client";
import {
  albumLink,
  DEFAULT_PAGE_SIZE,
  genreLink,
  LINK_PREFIX,
  MAX_PLAYLIST_CONTINUATION_PAGES,
  parseDetailLink,
  plainPlaylistId,
  playlistLink,
  radioLink,
  SEARCH_FILTERS,
  type SearchFilterKind,
  songLink,
} from "./constants";
import {
  creditsOf,
  dedupeVideoItems,
  extractGenreButtons,
  findAll,
  findOne,
  formatDuration,
  headerOf,
  imageOf,
  itemsOf,
  type JsonRecord,
  nextToken,
  ofKind,
  panelTrackOf,
  rowsOf,
  sectionsOf,
  textOf,
  toRexAlbum,
  toRexArtist,
  toRexPeoples,
  toRexPlaylist,
  toRexSong,
  type YtmAlbumRef,
  type YtmArtistRef,
  type YtmPlaylistRef,
  type YtmSection,
  type YtmTrackRef,
} from "./parser";
import {
  cacheSongMetaList,
  getCachedSongMeta,
  getContinuationToken,
  getLastPlayedVideoId,
  getRadioSeeds,
  getRuntimeConfig,
  type RuntimeConfig,
  rememberRadioSeeds,
  setContinuationToken,
  setLastPlayedVideoId,
  syncRuntimeConfig,
} from "./storage";

interface CommonGlobalParams {
  language?: string;
  cookie?: string;
  audioFormat?: string;
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

function sliceByPage<T>(items: T[], params: PaginationParams, pageSize = DEFAULT_PAGE_SIZE): T[] {
  const offsetRaw = Number(params.offset);
  const offset =
    params.offset !== undefined && params.offset !== "" && Number.isFinite(offsetRaw) && offsetRaw >= 0
      ? Math.floor(offsetRaw)
      : (parsePage(params.page) - 1) * pageSize;
  return items.slice(offset, offset + pageSize);
}

async function sectionsToRexItems(
  sections: YtmSection[],
  config: RuntimeConfig,
  filter: "all" | "songs" | "albums" | "playlists" | "artists" = "all",
): Promise<VideoItem[]> {
  const tracks = sections.flatMap((s) => s.tracks);
  if ((filter === "all" || filter === "songs") && tracks.length) {
    await enrichTrackDurations(tracks, config);
    rememberRadioSeeds(tracks.slice(0, 6).map((t) => t.id));
  }

  const out: VideoItem[] = [];
  for (const section of sections) {
    if (filter === "all" || filter === "songs") {
      for (const track of section.tracks) {
        out.push(toRexSong(track));
      }
    }
    if (filter === "all" || filter === "albums") {
      for (const album of section.albums) {
        out.push(toRexAlbum(album));
      }
    }
    if (filter === "all" || filter === "playlists") {
      for (const playlist of section.playlists) {
        out.push(toRexPlaylist(playlist));
      }
    }
    if (filter === "artists") {
      for (const artist of section.artists) {
        out.push(toRexArtist(artist));
      }
    }
  }

  const deduped = dedupeVideoItems(out);
  cacheSongMetaList(deduped);
  return deduped;
}

export async function handleHome(
  params: CommonGlobalParams & PaginationParams & { filter?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const filter = (params.filter || "all") as "all" | "songs" | "albums" | "playlists";
  const page = parsePage(params.page);
  const scope = `home:${config.cookie ? "auth" : "anon"}:${config.language}`;

  let answer: JsonRecord;
  if (page === 1) {
    answer = await browseById("FEmusic_home", config);
  } else {
    const token = getContinuationToken(scope, page);
    if (!token) {
      return [];
    }
    answer = await browseContinuation(token, config);
  }

  let sections = sectionsOf(answer);
  let next = nextToken(findOne(answer, "sectionListRenderer") || findOne(answer, "sectionListContinuation"));

  // Home page 1 sometimes returns only one small shelf (or non-music shelves); load one extra continuation if sparse.
  if (
    page === 1 &&
    next &&
    sections.reduce((sum, s) => sum + s.tracks.length + s.albums.length + s.playlists.length, 0) < 8
  ) {
    const more = await browseContinuation(next, config);
    sections = sections.concat(sectionsOf(more));
    next = nextToken(findOne(more, "sectionListContinuation"));
  }

  let items = await sectionsToRexItems(sections, config, filter);

  if (next && items.length) {
    setContinuationToken(scope, page + 1, next);
  }

  // Fallback to FEmusic_explore on page 1 if signed-out Home returned no music items (e.g. region/IP restrictions).
  if (page === 1 && !items.length) {
    const explore = await browseById("FEmusic_explore", config);
    items = await sectionsToRexItems(sectionsOf(explore), config, filter);
  }

  return items;
}

export async function handleCharts(
  params: CommonGlobalParams & PaginationParams & { category?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "all") as "all" | "songs" | "playlists" | "artists";
  const answer = await browseById("FEmusic_charts", config);
  const sections = sectionsOf(answer);

  if (category === "all") {
    const tracks = sections.flatMap((s) => s.tracks);
    if (tracks.length) {
      await enrichTrackDurations(tracks, config);
      rememberRadioSeeds(tracks.slice(0, 6).map((t) => t.id));
    }
    const items = dedupeVideoItems([
      ...tracks.map(toRexSong),
      ...sections.flatMap((s) => s.playlists).map(toRexPlaylist),
      ...sections.flatMap((s) => s.albums).map(toRexAlbum),
      ...sections.flatMap((s) => s.artists).map((a) => toRexArtist(a)),
    ]);
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }

  const items = await sectionsToRexItems(sections, config, category);
  return sliceByPage(items, params);
}

export async function handleNewReleases(
  params: CommonGlobalParams & PaginationParams & { category?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const category = (params.category || "all") as "all" | "albums" | "songs" | "playlists";
  const answer = await browseById("FEmusic_new_releases", config);
  const items = await sectionsToRexItems(sectionsOf(answer), config, category);
  return sliceByPage(items, params);
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

async function fetchPlaylistTracks(playlistId: string, config: RuntimeConfig, maxPages = 1): Promise<YtmTrackRef[]> {
  const answer = await browseById(`VL${plainPlaylistId(playlistId)}`, config);
  const collected: YtmTrackRef[] = [];
  let { items, token } = rowsOf(answer);
  collected.push(...ofKind(items, "track"));

  for (let i = 1; token && i < maxPages; i++) {
    ({ items, token } = rowsOf(await browseContinuation(token, config)));
    collected.push(...ofKind(items, "track"));
  }
  return enrichTrackDurations(collected, config);
}

export async function handleGenres(
  params: CommonGlobalParams & PaginationParams & { genreId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const rawGenreId = (params.genreId || "").trim();

  if (!rawGenreId) {
    let genres: VideoItem[] = [];
    try {
      const answer = await browseById("FEmusic_moods_and_genres", config);
      const buttons = extractGenreButtons(answer);
      genres = buttons.map((btn) => ({
        id: btn.id,
        type: "url",
        mediaType: "genre",
        link: genreLink(btn.params),
        title: btn.title,
      }));
    } catch {
      // Fallback below
    }

    if (!genres.length) {
      // Fallback: use chart genre playlists so native genre browsing still works in restricted regions.
      const charts = await browseById("FEmusic_charts", config);
      const genreSections = sectionsOf(charts).filter((section) => /(?:genre|流派|風格|风格)/i.test(section.title));
      const playlists = genreSections.flatMap((s) => s.playlists);
      genres = playlists.map((pl) => ({
        id: `pl:${pl.id}`,
        type: "url",
        mediaType: "genre",
        link: genreLink(`pl:${pl.id}`),
        title: pl.name,
        ...(pl.owner ? { subtitle: pl.owner } : {}),
        ...(pl.imageUrl ? { posterPath: pl.imageUrl, coverUrl: pl.imageUrl } : {}),
      }));
    }

    return sliceByPage(genres, params, 40);
  }

  const normalized = stripPrefix(rawGenreId, LINK_PREFIX.genre);
  const section = params.section || "albums";

  if (normalized.startsWith("pl:")) {
    const plId = normalized.slice(3);
    if (!plId) return [];
    const tracks = await fetchPlaylistTracks(plId, config, 1);
    if (section === "songs") {
      const items = tracks.map(toRexSong);
      cacheSongMetaList(items);
      return sliceByPage(items, params);
    }
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
    return [];
  }

  const answer = await browseById("FEmusic_moods_and_genres_category", config, { params: normalized });
  const sections = sectionsOf(answer);

  if (section === "albums") {
    const albums = dedupeVideoItems(sections.flatMap((s) => s.albums).map(toRexAlbum));
    if (albums.length) {
      return sliceByPage(albums, params);
    }
    // Many YouTube Music mood/genre categories list curated playlists rather than albums.
    const playlists = dedupeVideoItems(sections.flatMap((s) => s.playlists).map(toRexPlaylist));
    return sliceByPage(playlists, params);
  }

  if (section === "artists") {
    const artists = dedupeVideoItems(sections.flatMap((s) => s.artists).map((a) => toRexArtist(a)));
    return sliceByPage(artists, params);
  }

  if (section === "songs") {
    let tracks = sections.flatMap((s) => s.tracks);
    if (!tracks.length) {
      const firstPlaylist = sections.flatMap((s) => s.playlists)[0];
      if (firstPlaylist) {
        tracks = await fetchPlaylistTracks(firstPlaylist.id, config, 1);
      }
    } else {
      await enrichTrackDurations(tracks, config);
    }
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }

  return [];
}

async function resolvePersonalRadioSeed(config: RuntimeConfig): Promise<string> {
  const lastPlayed = getLastPlayedVideoId();
  if (lastPlayed) {
    return lastPlayed;
  }
  const savedSeeds = getRadioSeeds();
  if (savedSeeds[0]) {
    return savedSeeds[0];
  }
  const home = await browseById("FEmusic_home", config);
  const homeTrack = sectionsOf(home).flatMap((s) => s.tracks)[0];
  if (homeTrack?.id) {
    rememberRadioSeeds([homeTrack.id]);
    return homeTrack.id;
  }
  const newReleases = await browseById("FEmusic_new_releases", config);
  const releaseTrack = sectionsOf(newReleases).flatMap((s) => s.tracks)[0];
  if (releaseTrack?.id) {
    rememberRadioSeeds([releaseTrack.id]);
    return releaseTrack.id;
  }
  return "";
}

async function fetchRadioQueue(radioId: string, config: RuntimeConfig): Promise<YtmTrackRef[]> {
  const normalized = stripPrefix(radioId, LINK_PREFIX.radio);
  let nextBody: Record<string, unknown>;
  let excludeSeed = "";

  if (normalized === "personal") {
    const seed = await resolvePersonalRadioSeed(config);
    if (!seed) {
      return [];
    }
    excludeSeed = seed;
    nextBody = {
      videoId: seed,
      playlistId: `RDAMVM${seed}`,
      isAudioOnly: true,
      enablePersistentPlaylistPanel: true,
      tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
    };
  } else if (normalized.startsWith("vm:")) {
    const seed = normalized.slice(3);
    if (!seed) return [];
    nextBody = {
      videoId: seed,
      playlistId: `RDAMVM${seed}`,
      isAudioOnly: true,
      enablePersistentPlaylistPanel: true,
      tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
    };
  } else if (normalized.startsWith("pl:")) {
    const plId = plainPlaylistId(normalized.slice(3));
    if (!plId) return [];
    nextBody = {
      playlistId: `RDAMPL${plId}`,
      isAudioOnly: true,
      enablePersistentPlaylistPanel: true,
      tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
    };
  } else {
    return [];
  }

  const answer = await callInnertube("next", nextBody, config);
  const tracks = findAll<JsonRecord>(answer, "playlistPanelVideoRenderer")
    .map(panelTrackOf)
    .filter((track): track is YtmTrackRef => track !== null && track.id !== excludeSeed);

  if (!tracks.length && normalized.startsWith("pl:")) {
    return fetchPlaylistTracks(normalized.slice(3), config, 1);
  }

  return enrichTrackDurations(tracks, config);
}

export async function handleRadios(
  params: CommonGlobalParams & PaginationParams & { radioId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const rawRadioId = (params.radioId || "").trim();

  if (!rawRadioId) {
    const stations: VideoItem[] = [
      {
        id: "personal",
        type: "url",
        mediaType: "radio",
        link: radioLink("personal"),
        title: Widget.i18n("个性电台"),
        subtitle: Widget.i18n("根据你最近听过的音乐持续推荐相似曲目"),
        description: Widget.i18n("根据你最近听过的音乐持续推荐相似曲目"),
      },
    ];

    try {
      const charts = await browseById("FEmusic_charts", config);
      const playlists = sectionsOf(charts)
        .flatMap((s) => s.playlists)
        .slice(0, 12);
      for (const pl of playlists) {
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
      // Keep personal radio even if charts fail
    }

    return sliceByPage(stations, params);
  }

  const section = params.section || "songs";
  const tracks = await fetchRadioQueue(rawRadioId, config);

  if (section === "songs") {
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }
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
  return [];
}

export async function handleArtists(
  params: CommonGlobalParams & PaginationParams & { peopleId?: string; section?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const peopleId = (params.peopleId || "").trim();

  if (!peopleId) {
    const artists: YtmArtistRef[] = [];
    if (config.cookie) {
      try {
        const lib = await browseById("FEmusic_library_corpus_track_artists", config);
        artists.push(...sectionsOf(lib).flatMap((s) => s.artists));
      } catch {
        // Fallback to chart artists
      }
    }
    try {
      const charts = await browseById("FEmusic_charts", config);
      artists.push(...sectionsOf(charts).flatMap((s) => s.artists));
    } catch {
      // Ignore if charts unavailable
    }

    const items = dedupeVideoItems(artists.filter((a) => a.id).map((a) => toRexArtist(a)));
    return sliceByPage(items, params);
  }

  const answer = await browseById(peopleId, config);
  const header =
    findOne<JsonRecord>(answer, "musicImmersiveHeaderRenderer") ||
    findOne<JsonRecord>(answer, "musicVisualHeaderRenderer") ||
    {};
  const artistName = textOf(header.title);
  const artistAvatar = imageOf(header.thumbnail || header.foregroundThumbnail);
  const artistDescription = textOf(header.description);
  const sections = sectionsOf(answer);

  if (params.section === "profile") {
    if (!artistName) {
      return [];
    }
    return [
      toRexArtist(
        {
          id: peopleId,
          name: artistName,
          imageUrl: artistAvatar,
        },
        artistDescription || undefined,
      ),
    ];
  }

  if (params.section === "artists") {
    const similar = dedupeVideoItems(
      sections
        .flatMap((s) => s.artists)
        .filter((a) => a.id && a.id !== peopleId)
        .map((a) => toRexArtist(a)),
    );
    return sliceByPage(similar, params);
  }

  if (params.section === "albums") {
    const albums: YtmAlbumRef[] = sections.flatMap((s) => s.albums);
    const items = dedupeVideoItems(
      albums.map((album) =>
        toRexAlbum({
          ...album,
          artists: album.artists.length ? album.artists : artistName ? [{ id: peopleId, name: artistName }] : [],
        }),
      ),
    );
    return sliceByPage(items, params);
  }

  // section === "songs" or omitted (legacy person works list)
  let tracks = sections.flatMap((s) => s.tracks);
  if (!tracks.length) {
    // Some regions expose artist top tracks via an associated playlist shelf.
    const songShelf = sections.find((s) => s.browseId?.startsWith("VL"));
    if (songShelf?.browseId) {
      tracks = await fetchPlaylistTracks(songShelf.browseId, config, 1);
    }
  } else {
    await enrichTrackDurations(tracks, config);
  }

  const normalizedTracks = tracks.map((track) => ({
    ...track,
    artists: track.artists.length ? track.artists : artistName ? [{ id: peopleId, name: artistName }] : [],
  }));
  const items = dedupeVideoItems(normalizedTracks.map(toRexSong));
  cacheSongMetaList(items);
  return sliceByPage(items, params);
}

export async function handleLibrary(
  params: CommonGlobalParams & PaginationParams & { tab?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  if (!config.cookie) {
    throw new Error(Widget.i18n("请在模块设置中填写 YouTube Music Cookie 后查看个人音乐库"));
  }

  const tab = (params.tab || "liked") as "liked" | "playlists" | "history";
  const page = parsePage(params.page);

  if (tab === "playlists") {
    const answer = await browseById("FEmusic_liked_playlists", config);
    const playlists: YtmPlaylistRef[] = sectionsOf(answer)
      .flatMap((s) => s.playlists)
      .filter((pl) => pl.id !== "LM" && pl.id !== "SE");
    return sliceByPage(dedupeVideoItems(playlists.map(toRexPlaylist)), params);
  }

  if (tab === "history") {
    const answer = await browseById("FEmusic_history", config);
    const tracks = sectionsOf(answer).flatMap((s) => s.tracks);
    await enrichTrackDurations(tracks, config);
    const items = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(items);
    return sliceByPage(items, params);
  }

  // tab === "liked" (VLLM with real continuation pagination)
  const scope = `library:liked:${config.language}`;
  let answer: JsonRecord;
  if (page === 1) {
    answer = await browseById("VLLM", config);
  } else {
    const token = getContinuationToken(scope, page);
    if (!token) {
      return [];
    }
    answer = await browseContinuation(token, config);
  }
  const { items, token } = rowsOf(answer);
  if (token) {
    setContinuationToken(scope, page + 1, token);
  }
  const tracks = await enrichTrackDurations(ofKind(items, "track"), config);
  const rexItems = dedupeVideoItems(tracks.map(toRexSong));
  cacheSongMetaList(rexItems);
  return rexItems;
}

export async function handleSearch(
  params: CommonGlobalParams & PaginationParams & { keyword?: string; kind?: string },
): Promise<VideoItem[]> {
  const config = syncRuntimeConfig(params);
  const query = (params.keyword || "").trim();
  if (!query) {
    return [];
  }

  const kind = (params.kind || "all") as "all" | SearchFilterKind;
  const page = parsePage(params.page);

  if (kind === "all") {
    const scope = `search:all:${config.language}:${query}`;
    if (page === 1) {
      const answer = await callInnertube("search", { query }, config);
      const sections = sectionsOf(answer);
      const tracks = sections.flatMap((s) => s.tracks);
      if (tracks.length) {
        await enrichTrackDurations(tracks, config);
      }
      const out: VideoItem[] = [];
      for (const section of sections) {
        for (const artist of section.artists) out.push(toRexArtist(artist));
        for (const album of section.albums) out.push(toRexAlbum(album));
        for (const track of section.tracks) out.push(toRexSong(track));
        for (const playlist of section.playlists) out.push(toRexPlaylist(playlist));
      }
      const deduped = dedupeVideoItems(out);
      cacheSongMetaList(deduped);
      return deduped;
    }

    // Page 2+ on mixed search delegates to songs filter continuation if available.
    const token = getContinuationToken(scope, page);
    if (!token) {
      return [];
    }
    const answer = await callInnertube("search", { continuation: token }, config);
    const { items, token: next } = rowsOf(answer);
    if (next) {
      setContinuationToken(scope, page + 1, next);
    }
    const tracks = await enrichTrackDurations(ofKind(items, "track"), config);
    const out = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(out);
    return out;
  }

  const filter = SEARCH_FILTERS[kind];
  if (!filter) {
    return [];
  }

  const scope = `search:${kind}:${config.language}:${query}`;
  const singleKind = {
    songs: "track",
    albums: "album",
    artists: "artist",
    playlists: "playlist",
  }[kind] as "track" | "album" | "artist" | "playlist";

  let answer: JsonRecord;
  if (page === 1) {
    answer = await callInnertube("search", { query, params: filter }, config);
  } else {
    const token = getContinuationToken(scope, page);
    if (!token) {
      return [];
    }
    answer = await callInnertube("search", { continuation: token }, config);
  }

  const { items, token: next } = rowsOf(answer);
  if (next) {
    setContinuationToken(scope, page + 1, next);
  }

  let matched = ofKind(items, singleKind);

  // Resilient fallback on page 1: if region/IP suppresses a filtered tab, fall back to unfiltered search.
  if (page === 1 && !matched.length) {
    const unfiltered = await callInnertube("search", { query }, config);
    const sections = sectionsOf(unfiltered);
    if (singleKind === "track") {
      matched = sections.flatMap((s) => s.tracks) as typeof matched;
    } else if (singleKind === "album") {
      matched = sections.flatMap((s) => s.albums) as typeof matched;
    } else if (singleKind === "artist") {
      matched = sections.flatMap((s) => s.artists) as typeof matched;
    } else {
      matched = sections.flatMap((s) => s.playlists) as typeof matched;
    }
  }

  if (singleKind === "track") {
    const tracks = await enrichTrackDurations(matched as YtmTrackRef[], config);
    const rexItems = dedupeVideoItems(tracks.map(toRexSong));
    cacheSongMetaList(rexItems);
    return rexItems;
  }
  if (singleKind === "album") {
    return dedupeVideoItems((matched as YtmAlbumRef[]).map(toRexAlbum));
  }
  if (singleKind === "artist") {
    return dedupeVideoItems((matched as YtmArtistRef[]).map((a) => toRexArtist(a)));
  }
  return dedupeVideoItems((matched as YtmPlaylistRef[]).map(toRexPlaylist));
}

async function loadSongDetail(videoId: string, config: RuntimeConfig): Promise<VideoItem> {
  const cachedMeta = getCachedSongMeta(videoId);
  const stream = await resolveAudioStream(videoId, config);

  setLastPlayedVideoId(videoId);
  // Best-effort optional history reporting (never blocks or fails playback)
  await reportPlaybackHistory(videoId, config);

  const duration = stream.duration || cachedMeta?.duration || 0;
  const durationText = duration > 0 ? formatDuration(duration) : cachedMeta?.durationText;
  const cover = cachedMeta?.posterPath || cachedMeta?.coverUrl || stream.coverUrl;
  const peoples =
    cachedMeta?.peoples ||
    (stream.channelId && stream.author ? [{ id: stream.channelId, title: stream.author, role: "歌手" }] : undefined);
  const playerType = resolvePlayerType(config.playerType, stream.mimeType);

  return {
    id: videoId,
    type: "url",
    mediaType: "song",
    link: songLink(videoId),
    title: cachedMeta?.title || stream.title || videoId,
    ...(cachedMeta?.subtitle || stream.author ? { subtitle: cachedMeta?.subtitle || stream.author } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(duration > 0 ? { duration, ...(durationText ? { durationText } : {}) } : {}),
    ...(peoples?.length ? { peoples } : {}),
    videoUrl: stream.url,
    customHeaders: stream.headers,
    ...(playerType ? { playerType } : {}),
  };
}

async function loadAlbumDetail(browseId: string, config: RuntimeConfig): Promise<VideoItem> {
  const answer = await browseById(browseId, config);
  const header = headerOf(answer);
  const straplineRuns =
    header.straplineTextOne && typeof header.straplineTextOne === "object"
      ? ((header.straplineTextOne as JsonRecord).runs as unknown[]) || []
      : [];
  const subtitleRuns =
    header.subtitle && typeof header.subtitle === "object"
      ? ((header.subtitle as JsonRecord).runs as unknown[]) || []
      : [];
  const credits = creditsOf([...straplineRuns, ...subtitleRuns]);

  const title = textOf(header.title) || browseId;
  const cover = imageOf(header.thumbnail);
  const released = textOf(header.subtitle).match(/\b\d{4}\b/)?.[0];
  const description = textOf(findOne(header.description, "description") || header.description);

  const shelf = findOne<JsonRecord>(answer, "musicShelfRenderer");
  const rawTracks = ofKind(itemsOf(shelf?.contents), "track").map((track) => ({
    ...track,
    artists: track.artists.length ? track.artists : credits.artists,
    album: { id: browseId, name: title, imageUrl: cover },
    imageUrl: track.imageUrl || cover,
  }));
  const tracks = await enrichTrackDurations(rawTracks, config);
  const rexTracks = tracks.map(toRexSong);
  cacheSongMetaList(rexTracks);

  const relatedAlbums = dedupeVideoItems(
    sectionsOf(answer)
      .flatMap((section) => section.albums)
      .filter((album) => album.id !== browseId)
      .map(toRexAlbum),
  );

  const peoples = toRexPeoples(credits.artists);
  const subtitle = credits.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join(" / ");

  return {
    id: browseId,
    type: "url",
    mediaType: "album",
    link: albumLink(browseId),
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(released ? { releaseDate: released } : {}),
    ...(description ? { description } : {}),
    ...(peoples ? { peoples } : {}),
    tracks: rexTracks,
    ...(relatedAlbums.length ? { relatedItems: relatedAlbums } : {}),
  };
}

async function loadPlaylistDetail(playlistId: string, config: RuntimeConfig): Promise<VideoItem> {
  const plainId = plainPlaylistId(playlistId);
  const answer = await browseById(`VL${plainId}`, config);
  const header = headerOf(answer);
  const title = textOf(header.title) || plainId;
  const cover = imageOf(header.thumbnail);
  const owner = textOf(header.straplineTextOne);
  const description = textOf(findOne(header.description, "description") || header.description);

  const rawTracks: YtmTrackRef[] = [];
  let { items, token } = rowsOf(answer);
  rawTracks.push(...ofKind(items, "track"));

  for (let i = 1; token && i < MAX_PLAYLIST_CONTINUATION_PAGES; i++) {
    ({ items, token } = rowsOf(await browseContinuation(token, config)));
    rawTracks.push(...ofKind(items, "track"));
  }

  const tracks = await enrichTrackDurations(rawTracks, config);
  const rexTracks = tracks.map(toRexSong);
  cacheSongMetaList(rexTracks);

  return {
    id: plainId,
    type: "url",
    mediaType: "playlist",
    link: playlistLink(plainId),
    title,
    ...(owner ? { subtitle: owner } : {}),
    ...(cover ? { posterPath: cover, coverUrl: cover } : {}),
    ...(description ? { description } : {}),
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
