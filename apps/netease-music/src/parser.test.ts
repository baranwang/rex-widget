import { describe, expect, test } from "@rstest/core";
import { formatCoverUrl, parseDetailLink, resolvePlayerType } from "./constants";
import {
  dedupeVideoItems,
  formatDuration,
  formatReleaseDate,
  parseAlbum,
  parseArtist,
  parsePlaylist,
  parseTrack,
  toRexAlbum,
  toRexArtist,
  toRexPlaylist,
  toRexSong,
} from "./parser";

describe("constants & parser", () => {
  test("parseDetailLink parses internal and official web links", () => {
    expect(parseDetailLink("ncm:song:186016")).toEqual({ kind: "song", id: "186016" });
    expect(parseDetailLink("ncm:album:18886")).toEqual({ kind: "album", id: "18886" });
    expect(parseDetailLink("ncm:playlist:3778678")).toEqual({ kind: "playlist", id: "3778678" });
    expect(parseDetailLink("https://music.163.com/#/song?id=186016")).toEqual({ kind: "song", id: "186016" });
    expect(parseDetailLink("https://music.163.com/playlist?id=3778678&userid=1")).toEqual({
      kind: "playlist",
      id: "3778678",
    });
    expect(parseDetailLink("https://music.163.com/#/album?id=18886")).toEqual({ kind: "album", id: "18886" });
    expect(parseDetailLink("ncm:song:invalid")).toBeNull();
  });

  test("formatCoverUrl upgrades http and adds resize param on music.126.net", () => {
    expect(formatCoverUrl("http://p1.music.126.net/abc/123.jpg")).toBe(
      "https://p1.music.126.net/abc/123.jpg?param=500y500",
    );
    expect(formatCoverUrl("https://p2.music.126.net/abc/123.jpg?param=200y200")).toBe(
      "https://p2.music.126.net/abc/123.jpg?param=200y200",
    );
    expect(formatCoverUrl("https://example.com/cover.png")).toBe("https://example.com/cover.png");
  });

  test("resolvePlayerType routes FLAC to app decoder in auto mode", () => {
    expect(resolvePlayerType("auto", "flac")).toBe("app");
    expect(resolvePlayerType("auto", "mp3")).toBeUndefined();
    expect(resolvePlayerType("system", "flac")).toBe("system");
    expect(resolvePlayerType("app", "mp3")).toBe("app");
  });

  test("parses NetEase track, album, playlist, and artist shapes into Rex VideoItems", () => {
    const track = parseTrack({
      id: 186016,
      name: "晴天",
      dt: 269000,
      ar: [{ id: 6452, name: "周杰伦" }],
      al: { id: 18907, name: "叶惠美", picUrl: "http://p1.music.126.net/a/b.jpg" },
    });
    if (!track) {
      throw new Error("Expected parsed track");
    }
    const rexSong = toRexSong(track);
    expect(rexSong).toMatchObject({
      id: "186016",
      type: "url",
      mediaType: "song",
      link: "ncm:song:186016",
      title: "晴天",
      subtitle: "周杰伦",
      duration: 269,
      durationText: "4:29",
      posterPath: "https://p1.music.126.net/a/b.jpg?param=500y500",
    });
    expect(rexSong.peoples).toEqual([{ id: "6452", title: "周杰伦", role: "歌手" }]);

    // newsong wrapper shape
    const wrapped = parseTrack({
      id: 999,
      name: "新歌",
      picUrl: "http://p2.music.126.net/c/d.jpg",
      song: {
        id: 999,
        name: "新歌",
        duration: 185000,
        artists: [{ id: 11, name: "测试歌手" }],
        album: { id: 22, name: "测试专辑" },
      },
    });
    expect(wrapped?.duration).toBe(185);
    expect(wrapped?.imageUrl).toBe("https://p2.music.126.net/c/d.jpg?param=500y500");

    const album = parseAlbum({
      id: 18907,
      name: "叶惠美",
      publishTime: Date.UTC(2003, 6, 31),
      picUrl: "http://p1.music.126.net/a/b.jpg",
      artists: [{ id: 6452, name: "周杰伦" }],
    });
    if (!album) {
      throw new Error("Expected parsed album");
    }
    expect(toRexAlbum(album)).toMatchObject({
      id: "18907",
      mediaType: "album",
      link: "ncm:album:18907",
      releaseDate: "2003-07-31",
    });

    const playlist = parsePlaylist({
      id: 3778678,
      name: "热歌榜",
      coverImgUrl: "http://p1.music.126.net/chart.jpg",
      updateFrequency: "每天更新",
      tracks: [{ first: "晴天", second: "周杰伦" }],
    });
    if (!playlist) {
      throw new Error("Expected parsed playlist");
    }
    expect(toRexPlaylist(playlist)).toMatchObject({
      id: "3778678",
      mediaType: "playlist",
      link: "ncm:playlist:3778678",
      description: "每天更新\n1. 晴天 · 周杰伦",
    });

    const artist = parseArtist({
      id: 6452,
      name: "周杰伦",
      alias: ["Jay Chou"],
      img1v1Url: "http://p1.music.126.net/jay.jpg",
    });
    if (!artist) {
      throw new Error("Expected parsed artist");
    }
    expect(toRexArtist(artist)).toMatchObject({
      id: "6452",
      type: "person",
      mediaType: "person",
      title: "周杰伦",
      subtitle: "Jay Chou",
    });

    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatReleaseDate(Date.UTC(2024, 0, 5))).toBe("2024-01-05");
    expect(dedupeVideoItems([rexSong, rexSong])).toHaveLength(1);
  });
});
