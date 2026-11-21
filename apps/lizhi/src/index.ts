import { WIDGET_I18N } from "./i18n";
import {
  handleAlbums,
  handleAllSongs,
  handleArtists,
  handleDetail,
  handleHome,
  handleRadios,
  handleRecent,
  handleSearch,
} from "./service";

const widgetVersion = (() => {
  if (process.env.NODE_ENV === "production") {
    return process.env.PACKAGE_VERSION || "0.1.0";
  }
  const date = new Date();
  return `0.0.0-${[date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((item) => item.toString().padStart(2, "0"))
    .join("")}`;
})();

WidgetMetadata = {
  id: "baranwang.music.lizhi",
  title: process.env.NODE_ENV === "production" ? "李志" : "李志 (测试)",
  description:
    "李志音乐插件，收录 nj-lizhi/song 公开仓库的专辑与现场，支持每日推荐、专辑浏览、全部歌曲、随机电台、歌手主页、最近播放与搜索",
  author: "Baran",
  version: widgetVersion,
  site: "https://github.com/baranwang/rex-widget/tree/main/apps/lizhi",
  requiredVersion: "0.0.7",
  contentType: "music",
  continuousPlay: true,
  iconurl: "https://avatars.githubusercontent.com/u/84661866",
  detailCacheDuration: 60,
  i18n: WIDGET_I18N,
  globalParams: [
    {
      name: "language",
      title: "语言",
      type: "language",
    },
    {
      name: "cdnMirror",
      title: "CDN 线路",
      description: "用于加载封面与 20 MB 以内的音频；超过 20 MB 的大文件将自动切换至 GitHub Raw",
      type: "enumeration",
      value: "testingcf",
      enumOptions: [
        { title: "testingcf.jsdelivr.net（默认）", value: "testingcf" },
        { title: "cdn.jsdelivr.net", value: "jsdelivr" },
        { title: "fastly.jsdelivr.net", value: "fastly" },
        { title: "GitHub Raw（直连）", value: "raw" },
      ],
    },
    {
      name: "playerType",
      title: "播放器偏好",
      type: "enumeration",
      value: "auto",
      enumOptions: [
        { title: "自动（FLAC 优先软解）", value: "auto" },
        { title: "系统播放器 (system)", value: "system" },
        { title: "软件解码 (app)", value: "app" },
      ],
    },
  ],
  modules: [
    {
      id: "home",
      title: "首页推荐",
      subtitle: "每日随机推荐与精选专辑",
      type: "video",
      functionName: "loadHome",
      cacheDuration: 600,
      params: [
        {
          name: "filter",
          title: "筛选",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "今日推荐", value: "picks" },
            { title: "全部专辑", value: "albums" },
            { title: "最近播放", value: "recent" },
          ],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
      ],
    },
    {
      id: "albums",
      title: "专辑",
      subtitle: "全部专辑与现场录音",
      type: "video",
      functionName: "loadAlbums",
      cacheDuration: 3600,
      params: [
        {
          name: "sort",
          title: "排序",
          type: "enumeration",
          value: "default",
          enumOptions: [
            { title: "默认排序", value: "default" },
            { title: "曲目数优先", value: "tracks" },
            { title: "每日随机", value: "daily" },
          ],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
      ],
    },
    {
      id: "allSongs",
      title: "全部歌曲",
      subtitle: "完整曲库浏览与播放",
      type: "video",
      functionName: "loadAllSongs",
      cacheDuration: 3600,
      params: [
        {
          name: "sort",
          title: "排序",
          type: "enumeration",
          value: "album",
          enumOptions: [
            { title: "按专辑排序", value: "album" },
            { title: "按歌名排序", value: "title" },
            { title: "每日随机", value: "daily" },
          ],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
      ],
    },
    {
      id: "musicRadios",
      title: "电台",
      subtitle: "随机连播与每日电台",
      type: "video",
      functionName: "loadRadios",
      cacheDuration: 60,
      params: [
        {
          name: "radioId",
          title: "电台 ID",
          type: "input",
        },
        {
          name: "section",
          title: "分区",
          type: "enumeration",
          enumOptions: [
            { title: "歌曲", value: "songs" },
            { title: "专辑", value: "albums" },
            { title: "歌手", value: "artists" },
          ],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
        {
          name: "offset",
          title: "偏移量",
          type: "offset",
        },
      ],
    },
    {
      id: "musicArtists",
      title: "歌手",
      subtitle: "李志主页与全部作品",
      type: "person",
      functionName: "loadArtists",
      cacheDuration: 3600,
      params: [
        {
          name: "peopleId",
          title: "歌手 ID",
          type: "input",
        },
        {
          name: "section",
          title: "歌手分区",
          type: "enumeration",
          enumOptions: [
            { title: "歌曲", value: "songs" },
            { title: "专辑", value: "albums" },
            { title: "资料", value: "profile" },
            { title: "相似歌手", value: "artists" },
          ],
        },
        {
          name: "page",
          title: "页码",
          type: "page",
        },
        {
          name: "offset",
          title: "偏移量",
          type: "offset",
        },
      ],
    },
    {
      id: "recent",
      title: "最近播放",
      subtitle: "本机收听历史记录",
      type: "video",
      functionName: "loadRecent",
      cacheDuration: 5,
      params: [
        {
          name: "page",
          title: "页码",
          type: "page",
        },
      ],
    },
  ],
  search: {
    id: "search",
    title: "搜索",
    subtitle: "搜索李志的歌曲、专辑与歌手",
    functionName: "search",
    params: [
      {
        name: "kind",
        title: "结果类型",
        type: "enumeration",
        value: "all",
        enumOptions: [
          { title: "全部（音乐混合）", value: "all" },
          { title: "歌曲", value: "songs" },
          { title: "专辑", value: "albums" },
          { title: "歌手", value: "artists" },
        ],
      },
      {
        name: "page",
        title: "页码",
        type: "page",
      },
    ],
  },
};

loadHome = async (params) => handleHome(params);

loadAlbums = async (params) => handleAlbums(params);

loadAllSongs = async (params) => handleAllSongs(params);

loadRadios = async (params) => handleRadios(params);

loadArtists = async (params) => handleArtists(params);

loadRecent = async (params) => handleRecent(params);

search = async (params) => handleSearch(params);

loadDetail = async (link) => handleDetail(link);
