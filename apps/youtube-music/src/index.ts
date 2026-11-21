import { WIDGET_I18N } from "./i18n";
import {
  handleArtists,
  handleCharts,
  handleDetail,
  handleGenres,
  handleHome,
  handleLibrary,
  handleNewReleases,
  handleRadios,
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
  id: "baranwang.music.youtube",
  title: process.env.NODE_ENV === "production" ? "YouTube Music" : "YouTube Music (测试)",
  description: "YouTube Music 音乐插件，支持首页推荐、排行榜、新发行、流派、电台、歌手、搜索、专辑、歌单与直接音频播放",
  author: "Baran",
  version: widgetVersion,
  site: "https://github.com/baranwang/rex-widget/tree/main/apps/youtube-music",
  requiredVersion: "0.0.7",
  contentType: "music",
  continuousPlay: true,
  iconurl: "https://music.youtube.com/img/favicon_144.png",
  detailCacheDuration: 60,
  i18n: WIDGET_I18N,
  globalParams: [
    {
      name: "language",
      title: "语言",
      type: "language",
    },
    {
      name: "cookie",
      title: "YouTube Music Cookie（可选）",
      description:
        "可选。粘贴 music.youtube.com 请求的完整 Cookie 头（或直接粘贴 Network 面板中 browse 请求的 Copy as cURL），不要只填单个 SAPISID 值；不填可直接使用公开曲库。",
      type: "input",
      value: "",
    },
    {
      name: "audioFormat",
      title: "音频格式偏好",
      description: "AAC (M4A) 兼容系统播放器与软解；Opus (WebM) 码率更高，默认通过软件解码播放",
      type: "enumeration",
      value: "aac",
      enumOptions: [
        { title: "AAC (M4A，兼容性最佳)", value: "aac" },
        { title: "Opus (WebM，高音质)", value: "opus" },
        { title: "自动（最高码率）", value: "best" },
      ],
    },
    {
      name: "playerType",
      title: "播放器偏好",
      type: "enumeration",
      value: "auto",
      enumOptions: [
        { title: "自动", value: "auto" },
        { title: "系统播放器 (system)", value: "system" },
        { title: "软件解码 (app)", value: "app" },
      ],
    },
    {
      name: "reportHistory",
      title: "上报收听历史",
      description: "填写 Cookie 后，播放歌曲时上报至 YouTube Music 历史记录以改善推荐",
      type: "enumeration",
      value: "false",
      enumOptions: [
        { title: "关闭", value: "false" },
        { title: "开启（需配置 Cookie）", value: "true" },
      ],
    },
  ],
  modules: [
    {
      id: "home",
      title: "首页推荐",
      subtitle: "个性化推荐与热门音乐",
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
            { title: "歌曲", value: "songs" },
            { title: "专辑", value: "albums" },
            { title: "歌单", value: "playlists" },
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
      id: "charts",
      title: "排行榜",
      subtitle: "热门榜单歌曲、歌单与歌手",
      type: "video",
      functionName: "loadCharts",
      cacheDuration: 3600,
      params: [
        {
          name: "category",
          title: "分类",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "热门歌曲", value: "songs" },
            { title: "榜单歌单", value: "playlists" },
            { title: "热门歌手", value: "artists" },
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
      id: "newReleases",
      title: "新发行",
      subtitle: "最新发布的专辑、单曲与歌单",
      type: "video",
      functionName: "loadNewReleases",
      cacheDuration: 3600,
      params: [
        {
          name: "category",
          title: "分类",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "新专辑", value: "albums" },
            { title: "新单曲", value: "songs" },
            { title: "新歌单", value: "playlists" },
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
      id: "musicGenres",
      title: "流派与心情",
      subtitle: "按音乐流派与心情浏览",
      type: "video",
      functionName: "loadGenres",
      cacheDuration: 3600,
      params: [
        {
          name: "genreId",
          title: "流派 ID",
          type: "input",
        },
        {
          name: "section",
          title: "分区",
          type: "enumeration",
          enumOptions: [
            { title: "专辑", value: "albums" },
            { title: "歌曲", value: "songs" },
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
      id: "musicRadios",
      title: "电台",
      subtitle: "个性电台与主题电台连播",
      type: "video",
      functionName: "loadRadios",
      cacheDuration: 300,
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
      subtitle: "热门音乐人与歌手主页",
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
      id: "library",
      title: "我的音乐库",
      subtitle: "喜欢的音乐、个人歌单与最近播放（需配置 Cookie）",
      type: "video",
      functionName: "loadLibrary",
      cacheDuration: 120,
      params: [
        {
          name: "tab",
          title: "分类",
          type: "enumeration",
          value: "liked",
          enumOptions: [
            { title: "我喜欢的音乐", value: "liked" },
            { title: "我的歌单", value: "playlists" },
            { title: "最近播放", value: "history" },
          ],
        },
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
    subtitle: "搜索歌曲、专辑、歌手与歌单",
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
          { title: "歌单", value: "playlists" },
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

loadCharts = async (params) => handleCharts(params);

loadNewReleases = async (params) => handleNewReleases(params);

loadGenres = async (params) => handleGenres(params);

loadRadios = async (params) => handleRadios(params);

loadArtists = async (params) => handleArtists(params);

loadLibrary = async (params) => handleLibrary(params);

search = async (params) => handleSearch(params);

loadDetail = async (link) => handleDetail(link);
