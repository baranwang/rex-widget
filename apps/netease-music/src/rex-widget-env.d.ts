/// <reference types='@rexnow/libs/env' />
declare namespace BaranwangMusicNetease {
  interface GlobalParams {
    /**
     * 网易云音乐 Cookie（可选）
     * @description 可选。支持直接粘贴 MUSIC_U 值、完整 Cookie 请求头或 Copy as cURL；不填可直接使用公开曲库与免费歌曲，填写后解锁每日推荐、私人漫游、个人歌单、云盘与黑胶 VIP / 无损音质。
     * @default ''
     */
    cookie: string;
    /**
     * 音质偏好
     * @description 无损与 Hi-Res 需要黑胶 VIP / SVIP Cookie，FLAC 在自动模式下优先使用软件解码
     * @default 'exhigh'
     */
    quality: "standard" | "higher" | "exhigh" | "lossless" | "hires";
    /**
     * VIP 试听片段
     * @description 遇到无完整权限的 VIP 歌曲时，是否允许播放 30 秒试听片段
     * @default 'false'
     */
    allowTrial: "false" | "true";
    /**
     * 播放器偏好
     * @default 'auto'
     */
    playerType: "auto" | "system" | "app";
  }
}

//#region home
/** Params of 首页推荐 */
interface LoadHomeParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /**
   * 筛选
   * @default 'all'
   */
  filter: "all" | "daily" | "songs" | "playlists";
  /** 页码 */
  page: string;
}

/** Return Type of 首页推荐 */
interface LoadHomeReturnType extends Array<VideoItem> {}

/**
 * 首页推荐
 * @description 每日推荐、推荐歌单与新歌精选
 */
declare let loadHome: (params: LoadHomeParams) => LoadHomeReturnType | Promise<LoadHomeReturnType>;
//#endregion home

//#region charts
/** Params of 排行榜 */
interface LoadChartsParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /**
   * 分类
   * @default 'all'
   */
  category: "all" | "official" | "global";
  /** 页码 */
  page: string;
}

/** Return Type of 排行榜 */
interface LoadChartsReturnType extends Array<VideoItem> {}

/**
 * 排行榜
 * @description 官方榜与全球精选榜单
 */
declare let loadCharts: (params: LoadChartsParams) => LoadChartsReturnType | Promise<LoadChartsReturnType>;
//#endregion charts

//#region newReleases
/** Params of 新歌速递 */
interface LoadNewReleasesParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /**
   * 分类
   * @default 'albums'
   */
  category: "albums" | "songs";
  /**
   * 地区
   * @default 'ALL'
   */
  area: "ALL" | "ZH" | "EA" | "KR" | "JP";
  /** 页码 */
  page: string;
}

/** Return Type of 新歌速递 */
interface LoadNewReleasesReturnType extends Array<VideoItem> {}

/**
 * 新歌速递
 * @description 最新上架专辑与新歌速递
 */
declare let loadNewReleases: (
  params: LoadNewReleasesParams,
) => LoadNewReleasesReturnType | Promise<LoadNewReleasesReturnType>;
//#endregion newReleases

//#region musicGenres
/** Params of 歌单分类 */
interface LoadGenresParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /** 分类 ID */
  genreId: string;
  /** 分区 */
  section: "albums" | "songs";
  /** 页码 */
  page: string;
  /** 偏移量 */
  offset: string;
}

/** Return Type of 歌单分类 */
interface LoadGenresReturnType extends Array<VideoItem> {}

/**
 * 歌单分类
 * @description 按语种、风格、场景与情感浏览歌单
 */
declare let loadGenres: (params: LoadGenresParams) => LoadGenresReturnType | Promise<LoadGenresReturnType>;
//#endregion musicGenres

//#region musicRadios
/** Params of 电台与漫游 */
interface LoadRadiosParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /** 电台 ID */
  radioId: string;
  /** 分区 */
  section: "songs" | "albums" | "artists";
  /** 页码 */
  page: string;
  /** 偏移量 */
  offset: string;
}

/** Return Type of 电台与漫游 */
interface LoadRadiosReturnType extends Array<VideoItem> {}

/**
 * 电台与漫游
 * @description 私人漫游、心动模式、私人雷达与榜单电台
 */
declare let loadRadios: (params: LoadRadiosParams) => LoadRadiosReturnType | Promise<LoadRadiosReturnType>;
//#endregion musicRadios

//#region musicArtists
/** Params of 歌手 */
interface LoadArtistsParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /** 歌手 ID */
  peopleId: string;
  /** 歌手分区 */
  section: "songs" | "albums" | "profile" | "artists";
  /** 页码 */
  page: string;
  /** 偏移量 */
  offset: string;
}

/** Return Type of 歌手 */
interface LoadArtistsReturnType extends Array<VideoItem> {}

/**
 * 歌手
 * @description 热门歌手与歌手主页
 */
declare let loadArtists: (params: LoadArtistsParams) => LoadArtistsReturnType | Promise<LoadArtistsReturnType>;
//#endregion musicArtists

//#region library
/** Params of 我的音乐库 */
interface LoadLibraryParams extends BaranwangMusicNetease.GlobalParams, VideoListParams {
  /**
   * 分类
   * @default 'liked'
   */
  tab: "liked" | "playlists" | "cloud" | "recent_week" | "recent_all";
  /** 页码 */
  page: string;
}

/** Return Type of 我的音乐库 */
interface LoadLibraryReturnType extends Array<VideoItem> {}

/**
 * 我的音乐库
 * @description 我喜欢的音乐、个人歌单、音乐云盘与听歌排行（需配置 Cookie）
 */
declare let loadLibrary: (params: LoadLibraryParams) => LoadLibraryReturnType | Promise<LoadLibraryReturnType>;
//#endregion library

//#region search
/** Params of 搜索 */
interface SearchParams extends BaranwangMusicNetease.GlobalParams {
  /** 搜索关键词（由 Rex 注入） */
  keyword: string;
  /**
   * 结果类型
   * @default 'all'
   */
  kind: "all" | "songs" | "albums" | "artists" | "playlists";
  /** 页码 */
  page: string;
}

/** Return Type of 搜索 */
interface SearchReturnType extends Array<VideoItem> {}

/**
 * 搜索
 * @description 搜索歌曲、专辑、歌手与歌单
 */
declare let search: (params: SearchParams) => SearchReturnType | Promise<SearchReturnType>;
//#endregion search
