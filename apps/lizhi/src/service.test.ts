import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import { resetCatalogMemoryCache } from "./catalog";
import { CDN_LIMIT } from "./constants";
import "./index";

const MOCK_TREE = {
  tree: [
    { type: "blob", path: "audio/cover.png", size: 44516 },
    { type: "blob", path: "audio/8/cover.png", size: 435268 },
    { type: "blob", path: "audio/8/Hey Jude.mp3", size: 5_000_000 },
    { type: "blob", path: "audio/8/小螺号.mp3", size: 4_500_000 },
    { type: "blob", path: "audio/108个关键词/cover.png", size: 383405 },
    { type: "blob", path: "audio/108个关键词/倒影.mp3", size: 6_876_999 },
    { type: "blob", path: "audio/108个关键词/墙上的向日葵.mp3", size: CDN_LIMIT + 1000 },
    { type: "blob", path: "audio/108个关键词/青春.flac", size: 19_261_126 },
    { type: "blob", path: "audio/1701/cover.png", size: 160226 },
    { type: "blob", path: "audio/1701/大象.mp3", size: 13_143_218 },
    { type: "blob", path: "audio/1701/热河.mp3", size: 11_200_000 },
    { type: "blob", path: "audio/梵高先生/cover.png", size: 473267 },
    { type: "blob", path: "audio/梵高先生/广场.mp3", size: 9_800_000 },
    { type: "blob", path: "audio/梵高先生/梵高先生.mp3", size: 10_500_000 },
    { type: "blob", path: "audio/梵高先生/你离开了南京，从此没有人和我说话.mp3", size: 12_000_000 },
    { type: "blob", path: "audio/动静/cover.png", size: 626288 },
    { type: "blob", path: "audio/动静/地方.flac", size: 40_452_968 },
    { type: "blob", path: "audio/被禁忌的游戏/cover.png", size: 355047 },
    { type: "blob", path: "audio/被禁忌的游戏/青春.wav", size: 33_967_764 },
  ],
};

function mockGitHubTree(tree = MOCK_TREE) {
  return rs.spyOn(Widget.http, "request").mockImplementation(async (options) => {
    if (options.url.includes("api.github.com")) {
      return { data: tree, statusCode: 200, headers: {} };
    }
    throw new Error(`Unexpected HTTP call: ${options.url}`);
  });
}

describe("Rex Li Zhi music widget", () => {
  const originalLocale = process.env.REX_LOCALE;

  beforeEach(() => {
    Widget.storage.clear();
    resetCatalogMemoryCache();
    process.env.REX_LOCALE = "zh-CN";
  });

  afterEach(() => {
    rs.restoreAllMocks();
    Widget.storage.clear();
    resetCatalogMemoryCache();
    if (originalLocale === undefined) {
      delete process.env.REX_LOCALE;
    } else {
      process.env.REX_LOCALE = originalLocale;
    }
  });

  test("registers Rex 0.0.7 music metadata and all entrypoints", () => {
    expect(WidgetMetadata.id).toBe("baranwang.music.lizhi");
    expect(WidgetMetadata.contentType).toBe("music");
    expect(WidgetMetadata.requiredVersion).toBe("0.0.7");
    expect(WidgetMetadata.continuousPlay).toBe(true);
    expect(WidgetMetadata.iconurl).toBe("https://avatars.githubusercontent.com/u/84661866");
    expect(WidgetMetadata.modules.map((m) => m.id)).toEqual([
      "home",
      "albums",
      "allSongs",
      "musicRadios",
      "musicArtists",
      "recent",
    ]);
    expect(WidgetMetadata.search?.functionName).toBe("search");
    expect(typeof loadHome).toBe("function");
    expect(typeof loadAlbums).toBe("function");
    expect(typeof loadAllSongs).toBe("function");
    expect(typeof loadRadios).toBe("function");
    expect(typeof loadArtists).toBe("function");
    expect(typeof loadRecent).toBe("function");
    expect(typeof search).toBe("function");
    expect(typeof loadDetail).toBe("function");
  });

  test("loadHome supports all, picks, albums, and recent filters", async () => {
    mockGitHubTree();

    const all = await loadHome({ filter: "all", page: "1" } as LoadHomeParams);
    expect(all[0]).toMatchObject({
      id: "today",
      mediaType: "playlist",
      link: "lizhi:playlist:today",
      title: "今天听李志",
    });
    expect(all.some((item) => item.mediaType === "song")).toBe(true);
    expect(all.some((item) => item.mediaType === "album")).toBe(true);

    const picks = await loadHome({ filter: "picks", page: "1" } as LoadHomeParams);
    expect(picks).toHaveLength(12);
    expect(picks.every((item) => item.mediaType === "song")).toBe(true);
    expect(picks.every((item) => item.videoUrl === undefined)).toBe(true);

    const albums = await loadHome({ filter: "albums", page: "1" } as LoadHomeParams);
    expect(albums.map((a) => a.id)).toEqual(["8", "108个关键词", "1701", "动静", "梵高先生", "被禁忌的游戏"]);

    const recentEmpty = await loadHome({ filter: "recent", page: "1" } as LoadHomeParams);
    expect(recentEmpty).toEqual([]);
  });

  test("loadAlbums and loadAllSongs support sorting modes and pagination", async () => {
    mockGitHubTree();

    const defaultAlbums = await loadAlbums({ sort: "default", page: "1" } as LoadAlbumsParams);
    expect(defaultAlbums.map((a) => a.id)).toEqual(["8", "108个关键词", "1701", "动静", "梵高先生", "被禁忌的游戏"]);

    const byTracks = await loadAlbums({ sort: "tracks", page: "1" } as LoadAlbumsParams);
    expect(byTracks[0]?.id).toBe("108个关键词");
    expect(byTracks[1]?.id).toBe("梵高先生");

    const byAlbum = await loadAllSongs({ sort: "album", page: "1" } as LoadAllSongsParams);
    expect(byAlbum).toHaveLength(12);
    expect(byAlbum[0]?.id).toBe("audio/8/Hey Jude.mp3");

    const byTitle = await loadAllSongs({ sort: "title", page: "1" } as LoadAllSongsParams);
    expect(byTitle[0]?.title).toBe("Hey Jude");

    const page2 = await loadAllSongs({ sort: "album", page: "2" } as LoadAllSongsParams);
    expect(page2).toEqual([]);
  });

  test("loadDetail resolves song URLs (CDN vs Raw > 20 MB), playerType for FLAC, and updates recent history", async () => {
    mockGitHubTree();

    // Sync runtime config with fastly CDN mirror
    await loadAlbums({ sort: "default", page: "1", cdnMirror: "fastly", playerType: "auto" } as LoadAlbumsParams);

    const smallMp3 = (await loadDetail("lizhi:song:audio/梵高先生/广场.mp3")) as VideoItem;
    expect(smallMp3).toMatchObject({
      id: "audio/梵高先生/广场.mp3",
      mediaType: "song",
      title: "广场",
      subtitle: "李志 · 梵高先生",
    });
    expect(smallMp3.videoUrl).toContain("https://fastly.jsdelivr.net/gh/nj-lizhi/song@main/");
    expect(smallMp3.playerType).toBeUndefined();
    expect(smallMp3.description).toContain("MP3");

    const largeMp3 = (await loadDetail("lizhi:song:audio/108个关键词/墙上的向日葵.mp3")) as VideoItem;
    expect(largeMp3.videoUrl).toContain("https://raw.githubusercontent.com/nj-lizhi/song/main/");
    expect(largeMp3.playerType).toBeUndefined();

    const smallFlac = (await loadDetail("lizhi:song:audio/108个关键词/青春.flac")) as VideoItem;
    expect(smallFlac.videoUrl).toContain("https://fastly.jsdelivr.net/gh/nj-lizhi/song@main/");
    expect(smallFlac.playerType).toBe("app");

    const largeFlac = (await loadDetail("lizhi:song:audio/动静/地方.flac")) as VideoItem;
    expect(largeFlac.videoUrl).toContain("https://raw.githubusercontent.com/nj-lizhi/song/main/");
    expect(largeFlac.playerType).toBe("app");

    const largeWav = (await loadDetail("lizhi:song:audio/被禁忌的游戏/青春.wav")) as VideoItem;
    expect(largeWav.videoUrl).toContain("https://raw.githubusercontent.com/nj-lizhi/song/main/");
    expect(largeWav.playerType).toBeUndefined();

    // Direct GitHub blob URL also resolves cleanly
    const fromGitHubUrl = (await loadDetail(
      "https://github.com/nj-lizhi/song/blob/main/audio/梵高先生/广场.mp3",
    )) as VideoItem;
    expect(fromGitHubUrl.id).toBe("audio/梵高先生/广场.mp3");

    // Recent list has most recently played track first without duplicates
    const recent = await loadRecent({ page: "1" } as LoadRecentParams);
    expect(recent.map((t) => t.id)).toEqual([
      "audio/梵高先生/广场.mp3",
      "audio/被禁忌的游戏/青春.wav",
      "audio/动静/地方.flac",
      "audio/108个关键词/青春.flac",
      "audio/108个关键词/墙上的向日葵.mp3",
    ]);

    const recentPlaylist = (await loadDetail("lizhi:playlist:recent")) as VideoItem;
    expect(recentPlaylist.mediaType).toBe("playlist");
    expect(recentPlaylist.tracks?.map((t) => t.id)).toEqual(recent.map((t) => t.id));

    // Explicit playerType overrides auto FLAC routing
    await loadAlbums({ sort: "default", page: "1", cdnMirror: "raw", playerType: "system" } as LoadAlbumsParams);
    const flacForcedSystem = (await loadDetail("lizhi:song:audio/108个关键词/青春.flac")) as VideoItem;
    expect(flacForcedSystem.playerType).toBe("system");
    expect(flacForcedSystem.videoUrl).toContain("https://raw.githubusercontent.com/nj-lizhi/song/main/");
  });

  test("loadDetail resolves albums with tracks & relatedItems and built-in playlists", async () => {
    mockGitHubTree();

    const album = (await loadDetail("lizhi:album:梵高先生")) as VideoItem;
    expect(album).toMatchObject({
      id: "梵高先生",
      mediaType: "album",
      title: "梵高先生",
      subtitle: "李志",
    });
    expect(album.tracks).toHaveLength(3);
    expect(album.tracks?.[0]?.subtitle).toBe("李志");
    expect(album.relatedItems?.length).toBe(5);
    expect(album.relatedItems?.some((item) => item.id === "梵高先生")).toBe(false);

    const todayPlaylist = (await loadDetail("lizhi:playlist:today")) as VideoItem;
    expect(todayPlaylist.mediaType).toBe("playlist");
    expect(todayPlaylist.tracks).toHaveLength(12);

    const allPlaylist = (await loadDetail("lizhi:playlist:all")) as VideoItem;
    expect(allPlaylist.tracks).toHaveLength(12);

    await expect(loadDetail("lizhi:album:不存在")).rejects.toThrow(/未找到专辑/);
    await expect(loadDetail("lizhi:song:audio/none/missing.mp3")).rejects.toThrow(/未找到歌曲/);
    await expect(loadDetail("lizhi:playlist:missing")).rejects.toThrow(/未找到歌单/);
    await expect(loadDetail("invalid:link")).rejects.toThrow(/无法识别/);
  });

  test("loadRadios returns stations and paginates Shuffle All cleanly across pages without duplicates", async () => {
    const largeTree = {
      tree: [
        { type: "blob", path: "audio/cover.png", size: 1000 },
        { type: "blob", path: "audio/1701/cover.png", size: 1000 },
        ...Array.from({ length: 25 }, (_, i) => ({
          type: "blob",
          path: `audio/1701/track-${i + 1}.mp3`,
          size: 5_000_000,
        })),
      ],
    };
    mockGitHubTree(largeTree);

    const stations = await loadRadios({} as LoadRadiosParams);
    expect(stations.map((s) => s.id)).toEqual(["all", "today"]);
    expect(stations.every((s) => s.mediaType === "radio")).toBe(true);

    const page1 = await loadRadios({
      radioId: "lizhi:radio:all",
      section: "songs",
      page: "1",
    } as LoadRadiosParams);
    const page2 = await loadRadios({
      radioId: "lizhi:radio:all",
      section: "songs",
      page: "2",
    } as LoadRadiosParams);
    expect(page1).toHaveLength(20);
    expect(page2).toHaveLength(5);
    expect(new Set([...page1, ...page2].map((t) => t.id)).size).toBe(25);

    const albums = await loadRadios({ radioId: "lizhi:radio:all", section: "albums" } as LoadRadiosParams);
    expect(albums).toHaveLength(1);

    const artists = await loadRadios({ radioId: "lizhi:radio:today", section: "artists" } as LoadRadiosParams);
    expect(artists).toHaveLength(1);
    expect(artists[0]).toMatchObject({ id: "lizhi", type: "person" });

    expect(await loadRadios({ radioId: "unknown" } as LoadRadiosParams)).toEqual([]);
  });

  test("loadArtists supports directory, profile, songs, albums, and empty similar artists", async () => {
    mockGitHubTree();

    const dir = await loadArtists({} as LoadArtistsParams);
    expect(dir).toHaveLength(1);
    expect(dir[0]).toMatchObject({ id: "lizhi", type: "person", mediaType: "person", title: "李志" });

    const profile = await loadArtists({ peopleId: "lizhi", section: "profile" } as LoadArtistsParams);
    expect(profile).toHaveLength(1);
    expect(profile[0]?.description).toContain("6 张专辑");
    expect(profile[0]?.description).toContain("12 首");

    const songs = await loadArtists({ peopleId: "lizhi", section: "songs" } as LoadArtistsParams);
    expect(songs).toHaveLength(12);

    const albums = await loadArtists({ peopleId: "lizhi", section: "albums" } as LoadArtistsParams);
    expect(albums).toHaveLength(6);

    expect(await loadArtists({ peopleId: "lizhi", section: "artists" } as LoadArtistsParams)).toEqual([]);
    expect(await loadArtists({ peopleId: "someone-else", section: "songs" } as LoadArtistsParams)).toEqual([]);
  });

  test("search prioritizes song title matches over album matches and matches artist aliases", async () => {
    mockGitHubTree();

    const empty = await search({ keyword: "   ", kind: "all", page: "1" } as SearchParams);
    expect(empty).toEqual([]);

    // "梵高先生" matches both the song "梵高先生" and other songs inside the album "梵高先生"
    const songs = await search({ keyword: "梵高先生", kind: "songs", page: "1" } as SearchParams);
    expect(songs.map((s) => s.title)).toEqual(["梵高先生", "你离开了南京，从此没有人和我说话", "广场"]);

    const albums = await search({ keyword: "1701", kind: "albums", page: "1" } as SearchParams);
    expect(albums.map((a) => a.id)).toEqual(["1701"]);

    const artistByEn = await search({ keyword: "Li Zhi", kind: "artists", page: "1" } as SearchParams);
    expect(artistByEn).toHaveLength(1);
    expect(artistByEn[0]?.id).toBe("lizhi");

    const mixed = await search({ keyword: "梵高", kind: "all", page: "1" } as SearchParams);
    expect(mixed[0]?.mediaType).toBe("album");
    expect(mixed[1]?.mediaType).toBe("song");
    expect(mixed[1]?.title).toBe("梵高先生");
  });

  test("supports English and Traditional Chinese localization via Widget.i18n", async () => {
    mockGitHubTree();

    process.env.REX_LOCALE = "en";
    const enDir = await loadArtists({} as LoadArtistsParams);
    expect(enDir[0]?.title).toBe("Li Zhi");

    const enStations = await loadRadios({} as LoadRadiosParams);
    expect(enStations[0]?.title).toBe("Shuffle All");
    expect(enStations[1]?.title).toBe("Today's Li Zhi");

    process.env.REX_LOCALE = "zh-TW";
    const twProfile = await loadArtists({ peopleId: "lizhi", section: "profile" } as LoadArtistsParams);
    expect(twProfile[0]?.description).toContain("張專輯");
  });
});
