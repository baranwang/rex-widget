/// <reference types='@rexnow/libs/env' />
declare namespace BaranwangMusicYoutube {
    interface GlobalParams {
        /** 语言 */
        language: string;
        /**
         * YouTube Music Cookie（可选）
         * @description 可选。粘贴 music.youtube.com 请求的完整 Cookie 头（或直接粘贴 Network 面板中 browse 请求的 Copy as cURL），不要只填单个 SAPISID 值；不填可直接使用公开曲库。
         * @default ''
         */
        cookie: string;
        /**
         * 音频格式偏好
         * @description AAC (M4A) 兼容系统播放器与软解；Opus (WebM) 码率更高，默认通过软件解码播放
         * @default 'aac'
         */
        audioFormat: 'aac' | 'opus' | 'best';
        /**
         * 播放器偏好
         * @default 'auto'
         */
        playerType: 'auto' | 'system' | 'app';
        /**
         * 上报收听历史
         * @description 填写 Cookie 后，播放歌曲时上报至 YouTube Music 历史记录以改善推荐
         * @default 'false'
         */
        reportHistory: 'false' | 'true';
    }
}

//#region home
/** Params of 首页推荐 */
interface LoadHomeParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /**
     * 筛选
     * @default 'all'
     */
    filter: 'all' | 'songs' | 'albums' | 'playlists';
    /** 页码 */
    page: string;
}

/** Return Type of 首页推荐 */
interface LoadHomeReturnType extends Array<VideoItem> {
}

/**
 * 首页推荐
 * @description 个性化推荐与热门音乐
 */
declare let loadHome: (params: LoadHomeParams) => LoadHomeReturnType | Promise<LoadHomeReturnType>;
//#endregion home

//#region charts
/** Params of 排行榜 */
interface LoadChartsParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /**
     * 分类
     * @default 'all'
     */
    category: 'all' | 'songs' | 'playlists' | 'artists';
    /** 页码 */
    page: string;
}

/** Return Type of 排行榜 */
interface LoadChartsReturnType extends Array<VideoItem> {
}

/**
 * 排行榜
 * @description 热门榜单歌曲、歌单与歌手
 */
declare let loadCharts: (params: LoadChartsParams) => LoadChartsReturnType | Promise<LoadChartsReturnType>;
//#endregion charts

//#region newReleases
/** Params of 新发行 */
interface LoadNewReleasesParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /**
     * 分类
     * @default 'all'
     */
    category: 'all' | 'albums' | 'songs' | 'playlists';
    /** 页码 */
    page: string;
}

/** Return Type of 新发行 */
interface LoadNewReleasesReturnType extends Array<VideoItem> {
}

/**
 * 新发行
 * @description 最新发布的专辑、单曲与歌单
 */
declare let loadNewReleases: (params: LoadNewReleasesParams) => LoadNewReleasesReturnType | Promise<LoadNewReleasesReturnType>;
//#endregion newReleases

//#region musicGenres
/** Params of 流派与心情 */
interface LoadGenresParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /** 流派 ID */
    genreId: string;
    /** 分区 */
    section: 'albums' | 'songs' | 'artists';
    /** 页码 */
    page: string;
    /** 偏移量 */
    offset: string;
}

/** Return Type of 流派与心情 */
interface LoadGenresReturnType extends Array<VideoItem> {
}

/**
 * 流派与心情
 * @description 按音乐流派与心情浏览
 */
declare let loadGenres: (params: LoadGenresParams) => LoadGenresReturnType | Promise<LoadGenresReturnType>;
//#endregion musicGenres

//#region musicRadios
/** Params of 电台 */
interface LoadRadiosParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /** 电台 ID */
    radioId: string;
    /** 分区 */
    section: 'songs' | 'albums' | 'artists';
    /** 页码 */
    page: string;
    /** 偏移量 */
    offset: string;
}

/** Return Type of 电台 */
interface LoadRadiosReturnType extends Array<VideoItem> {
}

/**
 * 电台
 * @description 个性电台与主题电台连播
 */
declare let loadRadios: (params: LoadRadiosParams) => LoadRadiosReturnType | Promise<LoadRadiosReturnType>;
//#endregion musicRadios

//#region musicArtists
/** Params of 歌手 */
interface LoadArtistsParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /** 歌手 ID */
    peopleId: string;
    /** 歌手分区 */
    section: 'songs' | 'albums' | 'profile' | 'artists';
    /** 页码 */
    page: string;
    /** 偏移量 */
    offset: string;
}

/** Return Type of 歌手 */
interface LoadArtistsReturnType extends Array<VideoItem> {
}

/**
 * 歌手
 * @description 热门音乐人与歌手主页
 */
declare let loadArtists: (params: LoadArtistsParams) => LoadArtistsReturnType | Promise<LoadArtistsReturnType>;
//#endregion musicArtists

//#region library
/** Params of 我的音乐库 */
interface LoadLibraryParams extends BaranwangMusicYoutube.GlobalParams, VideoListParams {
    /**
     * 分类
     * @default 'liked'
     */
    tab: 'liked' | 'playlists' | 'history';
    /** 页码 */
    page: string;
}

/** Return Type of 我的音乐库 */
interface LoadLibraryReturnType extends Array<VideoItem> {
}

/**
 * 我的音乐库
 * @description 喜欢的音乐、个人歌单与最近播放（需配置 Cookie）
 */
declare let loadLibrary: (params: LoadLibraryParams) => LoadLibraryReturnType | Promise<LoadLibraryReturnType>;
//#endregion library

//#region loadSubtitle
/** Params of 歌词 */
interface LoadSubtitleParams extends BaranwangMusicYoutube.GlobalParams, BaseParams {
}

/** Return Type of 歌词 */
interface LoadSubtitleReturnType extends Array<SubtitleItem> {
}

/**
 * 歌词
 * @description 获取歌曲同步歌词与纯文本歌词
 */
declare let loadSubtitle: (params: LoadSubtitleParams) => LoadSubtitleReturnType | Promise<LoadSubtitleReturnType>;
//#endregion loadSubtitle

//#region search
/** Params of 搜索 */
interface SearchParams extends BaranwangMusicYoutube.GlobalParams {
    /** 搜索关键词（由 Rex 注入） */
    keyword: string;
    /**
     * 结果类型
     * @default 'all'
     */
    kind: 'all' | 'songs' | 'albums' | 'artists' | 'playlists';
    /** 页码 */
    page: string;
}

/** Return Type of 搜索 */
interface SearchReturnType extends Array<VideoItem> {
}

/**
 * 搜索
 * @description 搜索歌曲、专辑、歌手与歌单
 */
declare let search: (params: SearchParams) => SearchReturnType | Promise<SearchReturnType>;
//#endregion search
