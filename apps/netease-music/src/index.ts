import { WIDGET_I18N } from "./i18n";
import {
  handleArtists,
  handleCharts,
  handleDetail,
  handleGenres,
  handleHome,
  handleLibrary,
  handleNewReleases,
  handlePodcasts,
  handleRadios,
  handleSearch,
  handleSubtitle,
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
  id: "baranwang.music.netease",
  title: process.env.NODE_ENV === "production" ? "网易云音乐" : "网易云音乐 (测试)",
  description:
    "网易云音乐插件，支持首页推荐、精品歌单、排行榜、新歌速递、歌单分类与曲风馆、播客电台、私人与场景漫游、歌手主页、搜索、时间轴歌词、个人音乐库与高解析音频播放",
  author: "Baran",
  version: widgetVersion,
  site: "https://github.com/baranwang/rex-widget/tree/main/apps/netease-music",
  requiredVersion: "0.0.7",
  contentType: "music",
  continuousPlay: true,
  iconurl: "https://s1.music.126.net/style/favicon.ico",
  detailCacheDuration: 60,
  i18n: WIDGET_I18N,
  globalParams: [
    {
      name: "cookie",
      title: "网易云音乐 Cookie（可选）",
      description:
        "可选。支持直接粘贴 MUSIC_U 值、完整 Cookie 请求头或 Copy as cURL；不填可直接使用公开曲库与免费歌曲，填写后解锁每日推荐、历史日推、私人漫游、个人音乐库、动态封面、听歌打卡与黑胶 VIP / 无损音质。",
      type: "input",
      value: "",
    },
    {
      name: "quality",
      title: "音质偏好",
      description: "无损与 SVIP 高解析音质需要黑胶 VIP / SVIP Cookie，FLAC 在自动模式下优先使用软件解码",
      type: "enumeration",
      value: "exhigh",
      enumOptions: [
        { title: "标准 (128k)", value: "standard" },
        { title: "较高 (192k)", value: "higher" },
        { title: "极高 (320k，兼容性最佳)", value: "exhigh" },
        { title: "无损 (FLAC，需 VIP)", value: "lossless" },
        { title: "Hi-Res (FLAC，需 SVIP)", value: "hires" },
        { title: "高清臻音 (SVIP)", value: "jyeffect" },
        { title: "沉浸环绕声 (SVIP)", value: "sky" },
        { title: "杜比全景声 (SVIP)", value: "dolby" },
        { title: "臻音全景声 (SVIP)", value: "vivid" },
        { title: "超清母带 (SVIP)", value: "jymaster" },
      ],
    },
    {
      name: "allowTrial",
      title: "VIP 试听片段",
      description: "遇到无完整权限的 VIP 歌曲时，是否允许播放 30 秒试听片段",
      type: "enumeration",
      value: "false",
      enumOptions: [
        { title: "跳过试听（仅播放完整歌曲）", value: "false" },
        { title: "允许播放 30 秒试听", value: "true" },
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
      title: "听歌打卡",
      description: "填写 Cookie 后，播放歌曲时上报至网易云听歌记录以更新听歌排行与每日推荐",
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
      subtitle: "每日推荐、历史日推、精品歌单与新歌精选",
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
            { title: "每日推荐", value: "daily" },
            { title: "历史日推", value: "history_daily" },
            { title: "精品歌单", value: "highquality" },
            { title: "歌曲", value: "songs" },
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
      subtitle: "官方榜、全球精选榜单与歌手榜",
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
            { title: "官方榜", value: "official" },
            { title: "全球榜", value: "global" },
            { title: "歌手榜", value: "artists" },
          ],
        },
        {
          name: "artistArea",
          title: "歌手榜地区",
          type: "enumeration",
          value: "ZH",
          belongTo: {
            paramName: "category",
            value: ["artists"],
          },
          enumOptions: [
            { title: "华语", value: "ZH" },
            { title: "欧美", value: "EA" },
            { title: "韩国", value: "KR" },
            { title: "日本", value: "JP" },
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
      title: "新歌速递",
      subtitle: "最新上架专辑与新歌速递",
      type: "video",
      functionName: "loadNewReleases",
      cacheDuration: 3600,
      params: [
        {
          name: "category",
          title: "分类",
          type: "enumeration",
          value: "albums",
          enumOptions: [
            { title: "新专辑", value: "albums" },
            { title: "新歌", value: "songs" },
          ],
        },
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          value: "ALL",
          enumOptions: [
            { title: "全部", value: "ALL" },
            { title: "华语", value: "ZH" },
            { title: "欧美", value: "EA" },
            { title: "韩国", value: "KR" },
            { title: "日本", value: "JP" },
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
      title: "歌单分类",
      subtitle: "按语种、风格、曲风馆与精品标签浏览",
      type: "video",
      functionName: "loadGenres",
      cacheDuration: 3600,
      params: [
        {
          name: "source",
          title: "浏览模式",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "歌单分类", value: "all" },
            { title: "曲风馆", value: "styles" },
            { title: "精品歌单分类", value: "highquality" },
          ],
        },
        {
          name: "genreId",
          title: "分类 ID",
          type: "input",
        },
        {
          name: "section",
          title: "分区",
          type: "enumeration",
          enumOptions: [
            { title: "歌单 / 专辑", value: "albums" },
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
      title: "电台与漫游",
      subtitle: "私人漫游、场景漫游、跑步漫游、心动模式与榜单电台",
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
      id: "podcasts",
      title: "播客电台",
      subtitle: "精选播客、热门电台榜与高人气节目",
      type: "video",
      functionName: "loadPodcasts",
      cacheDuration: 1800,
      params: [
        {
          name: "category",
          title: "分类",
          type: "enumeration",
          value: "recommend",
          enumOptions: [
            { title: "精选播客", value: "recommend" },
            { title: "热门播客", value: "hot" },
            { title: "热门电台榜", value: "toplist_hot" },
            { title: "新晋电台榜", value: "toplist_new" },
            { title: "热门节目榜", value: "programs" },
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
      id: "musicArtists",
      title: "歌手",
      subtitle: "热门歌手、分类筛选与歌手主页",
      type: "person",
      functionName: "loadArtists",
      cacheDuration: 3600,
      params: [
        {
          name: "area",
          title: "地区",
          type: "enumeration",
          value: "ALL",
          enumOptions: [
            { title: "全部", value: "ALL" },
            { title: "华语", value: "ZH" },
            { title: "欧美", value: "EA" },
            { title: "日本", value: "JP" },
            { title: "韩国", value: "KR" },
            { title: "其他", value: "OTHER" },
          ],
        },
        {
          name: "artistType",
          title: "类型",
          type: "enumeration",
          value: "ALL",
          enumOptions: [
            { title: "全部", value: "ALL" },
            { title: "男歌手", value: "MALE" },
            { title: "女歌手", value: "FEMALE" },
            { title: "乐队组合", value: "BAND" },
          ],
        },
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
      subtitle: "我喜欢的音乐、个人歌单、云盘、最近播放与收藏（需配置 Cookie）",
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
            { title: "音乐云盘", value: "cloud" },
            { title: "最近播放 · 歌曲", value: "recent_songs" },
            { title: "最近播放 · 专辑", value: "recent_albums" },
            { title: "最近播放 · 歌单", value: "recent_playlists" },
            { title: "收藏的专辑", value: "sub_albums" },
            { title: "关注的歌手", value: "sub_artists" },
            { title: "订阅的播客电台", value: "sub_podcasts" },
            { title: "最近一周听歌排行", value: "recent_week" },
            { title: "所有时间听歌排行", value: "recent_all" },
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
      id: "loadSubtitle",
      title: "歌词",
      subtitle: "网易云音乐时间轴歌词（双语 / 原文 / 译文 / 罗马音）",
      type: "subtitle",
      functionName: "loadSubtitle",
      cacheDuration: 3600,
    },
  ],
  search: {
    id: "search",
    title: "搜索",
    subtitle: "搜索歌曲、歌词、专辑、歌手、歌单、播客电台与声音（留空展示热搜榜）",
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
          { title: "按歌词搜歌", value: "lyrics" },
          { title: "专辑", value: "albums" },
          { title: "歌手", value: "artists" },
          { title: "歌单", value: "playlists" },
          { title: "播客电台", value: "dj" },
          { title: "声音 / 单集", value: "voices" },
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

loadPodcasts = async (params) => handlePodcasts(params);

loadArtists = async (params) => handleArtists(params);

loadLibrary = async (params) => handleLibrary(params);

loadSubtitle = async (params) => handleSubtitle(params);

search = async (params) => handleSearch(params);

loadDetail = async (link) => handleDetail(link);
